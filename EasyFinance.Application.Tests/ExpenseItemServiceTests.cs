using System.Text.Json;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Common.Tests.Financial;
using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class ExpenseItemServiceTests : BaseTests
    {
        public ExpenseItemServiceTests()
        {
            PrepareInMemoryDatabase();
        }

        [Fact]
        public async Task MoveAsync_MoveExpenseItemToAnotherExpense_ShouldMoveExpenseItem()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseItemService = scopedServices.GetRequiredService<IExpenseItemService>();
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var sourceProject = await unitOfWork.ProjectRepository
                .Trackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.Items)
                .FirstAsync(p => p.Id == this.project1.Id);

            var sourceCategory = sourceProject.Categories.First();
            var sourceExpense = sourceCategory.Expenses.First();
            var expenseItemToMove = sourceExpense.Items.First();
            var targetCategory = new Category(name: "Target category");
            sourceProject.AddCategory(targetCategory);

            var saveProjectResponse = unitOfWork.ProjectRepository.InsertOrUpdate(sourceProject);
            saveProjectResponse.Succeeded.Should().BeTrue();
            await unitOfWork.CommitAsync();

            var targetExpenseResponse = await expenseService.CreateAsync(
                this.user1,
                this.project1.Id,
                targetCategory.Id,
                new ExpenseRequestDTO
                {
                    Name = "Target expense",
                    Date = sourceExpense.Date,
                    Amount = 0,
                    Budget = 0,
                    Items = []
                });

            targetExpenseResponse.Succeeded.Should().BeTrue();

            var moveResponse = await expenseItemService.MoveAsync(
                projectId: this.project1.Id,
                sourceCategoryId: sourceCategory.Id,
                sourceExpenseId: sourceExpense.Id,
                expenseItemId: expenseItemToMove.Id,
                targetCategoryId: targetCategory.Id,
                targetExpenseId: targetExpenseResponse.Data.Id);

            moveResponse.Succeeded.Should().BeTrue();

            var refreshedProject = await unitOfWork.ProjectRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.Items)
                .FirstAsync(p => p.Id == this.project1.Id);

            var refreshedSourceExpense = refreshedProject.Categories
                .SelectMany(c => c.Expenses)
                .First(e => e.Id == sourceExpense.Id);
            var refreshedTargetExpense = refreshedProject.Categories
                .SelectMany(c => c.Expenses)
                .First(e => e.Id == targetExpenseResponse.Data.Id);

            refreshedSourceExpense.Items.Should().NotContain(i => i.Id == expenseItemToMove.Id);
            refreshedTargetExpense.Items.Should().Contain(i => i.Id == expenseItemToMove.Id);
        }

        [Fact]
        public async Task MoveAsync_MoveExpenseItemToDifferentMonthExpense_ShouldFail()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseItemService = scopedServices.GetRequiredService<IExpenseItemService>();
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var sourceProject = await unitOfWork.ProjectRepository
                .Trackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.Items)
                .FirstAsync(p => p.Id == this.project1.Id);

            var sourceCategory = sourceProject.Categories.First();
            var sourceExpense = sourceCategory.Expenses.First();
            var expenseItemToMove = sourceExpense.Items.First();
            var targetCategory = new Category(name: "Future category");
            sourceProject.AddCategory(targetCategory);

            var saveProjectResponse = unitOfWork.ProjectRepository.InsertOrUpdate(sourceProject);
            saveProjectResponse.Succeeded.Should().BeTrue();
            await unitOfWork.CommitAsync();

            var targetExpenseResponse = await expenseService.CreateAsync(
                this.user1,
                this.project1.Id,
                targetCategory.Id,
                new ExpenseRequestDTO
                {
                    Name = "Future expense",
                    Date = sourceExpense.Date.AddMonths(1),
                    Amount = 0,
                    Budget = 0,
                    Items = []
                });

            targetExpenseResponse.Succeeded.Should().BeTrue();

            var moveResponse = await expenseItemService.MoveAsync(
                projectId: this.project1.Id,
                sourceCategoryId: sourceCategory.Id,
                sourceExpenseId: sourceExpense.Id,
                expenseItemId: expenseItemToMove.Id,
                targetCategoryId: targetCategory.Id,
                targetExpenseId: targetExpenseResponse.Data.Id);

            moveResponse.Failed.Should().BeTrue();
            moveResponse.Messages.Should().Contain(message =>
                message.Description == ValidationMessages.CantAddExpenseItemWithDifferentYearOrMonthFromExpense);

            var refreshedProject = await unitOfWork.ProjectRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.Items)
                .FirstAsync(p => p.Id == this.project1.Id);

            var refreshedSourceExpense = refreshedProject.Categories
                .SelectMany(c => c.Expenses)
                .First(e => e.Id == sourceExpense.Id);
            var refreshedTargetExpense = refreshedProject.Categories
                .SelectMany(c => c.Expenses)
                .First(e => e.Id == targetExpenseResponse.Data.Id);

            refreshedSourceExpense.Items.Should().Contain(i => i.Id == expenseItemToMove.Id);
            refreshedTargetExpense.Items.Should().NotContain(i => i.Id == expenseItemToMove.Id);
        }

        [Fact]
        public async Task MoveAsync_MovedItemCausesTargetToExceedBudget_SendsNotification()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseItemService = scopedServices.GetRequiredService<IExpenseItemService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var project = new ProjectBuilder().AddName("Budget Move Project").Build();
            unitOfWork.ProjectRepository.InsertOrUpdate(project);

            var sourceCategory = new CategoryBuilder().AddName("Source Category").Build();
            project.AddCategory(sourceCategory);
            unitOfWork.CategoryRepository.InsertOrUpdate(sourceCategory);

            var targetCategory = new CategoryBuilder().AddName("Target Category").Build();
            project.AddCategory(targetCategory);
            unitOfWork.CategoryRepository.InsertOrUpdate(targetCategory);

            var itemDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));

            var itemToMove = new ExpenseItemBuilder()
                .AddName("Move Item")
                .AddAmount(85)
                .AddDate(itemDate)
                .AddCreatedBy(this.user1)
                .Build();

            var sourceExpense = new ExpenseBuilder()
                .AddName("Source Expense")
                .AddCreatedBy(this.user1)
                .AddAmount(0)
                .AddDate(itemDate)
                .Build();
            sourceExpense.AddItem(itemToMove);
            sourceCategory.AddExpense(sourceExpense);
            unitOfWork.ExpenseRepository.InsertOrUpdate(sourceExpense);

            var existingTargetItem = new ExpenseItemBuilder()
                .AddName("Existing Item")
                .AddAmount(20)
                .AddDate(itemDate)
                .AddCreatedBy(this.user1)
                .Build();

            var targetExpenseName = "Target Budget Expense";
            var targetExpense = new ExpenseBuilder()
                .AddName(targetExpenseName)
                .AddCreatedBy(this.user1)
                .AddAmount(0)
                .AddDate(itemDate)
                .Build();
            targetExpense.SetBudget(100);
            targetExpense.AddItem(existingTargetItem);
            targetCategory.AddExpense(targetExpense);
            unitOfWork.ExpenseRepository.InsertOrUpdate(targetExpense);

            unitOfWork.UserProjectRepository.InsertOrUpdate(
                new UserProjectBuilder().AddProject(project).AddUser(this.user1).AddAccepted().Build());

            await unitOfWork.CommitAsync();

            notificationServiceMock.Invocations.Clear();

            var moveResponse = await expenseItemService.MoveAsync(
                projectId: project.Id,
                sourceCategoryId: sourceCategory.Id,
                sourceExpenseId: sourceExpense.Id,
                expenseItemId: itemToMove.Id,
                targetCategoryId: targetCategory.Id,
                targetExpenseId: targetExpense.Id);

            moveResponse.Succeeded.Should().BeTrue();

            var expectedMetadata = JsonSerializer.Serialize(new { expenseName = targetExpenseName });
            notificationServiceMock.Verify(n => n.CreateNotificationAsync(It.Is<NotificationRequestDTO>(r =>
                r.CodeMessage == "BUDGET_OVERFLOW" &&
                r.Metadata == expectedMetadata)), Times.AtLeastOnce());
        }

        [Fact]
        public async Task RemoveLinkAsync_RemoveUserSoleAdmin_ShouldRemoveLinkWithCreatedBy()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseItemService = scopedServices.GetRequiredService<IExpenseItemService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();
            var userManager = scopedServices.GetRequiredService<UserManager<User>>();

            // Arrange
            // Act
            await expenseItemService.RemoveLinkAsync(this.user1);

            // Assert
            var project = unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.Items)
                            .ThenInclude(e => e.CreatedBy)
                .First(p => p.Id == this.project3.Id);

            project.Categories.First().Expenses.First().Items.First().CreatedBy.Id.Should().BeEmpty();
            project.Categories.First().Expenses.First().Items.First().CreatorName.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task RemoveLinkAsync_RemoveOnlyViewerUser_ShouldRemoveLinkWithCreatedBy()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseItemService = scopedServices.GetRequiredService<IExpenseItemService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            // Act
            await expenseItemService.RemoveLinkAsync(this.user3);

            // Assert
            var project = unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.Items)
                            .ThenInclude(e => e.CreatedBy)
                .First(p => p.Id == this.project1.Id);

            project.Categories.First().Expenses.First().Items.First().CreatedBy.Id.Should().BeEmpty();
            project.Categories.First().Expenses.First().Items.First().CreatorName.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task RemoveLinkAsync_RemoveNotSoleAdminUser_ShouldRemoveLinkWithCreatedBy()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseItemService = scopedServices.GetRequiredService<IExpenseItemService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            // Act
            await expenseItemService.RemoveLinkAsync(this.user2);

            // Assert
            var project = unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.Items)
                            .ThenInclude(e => e.CreatedBy)
                .First(p => p.Id == this.project2.Id);

            project.Categories.First().Expenses.First().Items.First().CreatedBy.Id.Should().BeEmpty();
            project.Categories.First().Expenses.First().Items.First().CreatorName.Should().NotBeNullOrEmpty();
        }
    }
}
