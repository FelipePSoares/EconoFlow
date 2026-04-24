using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Common.Tests.Financial;
using EasyFinance.Common.Tests.AccessControl;
using Microsoft.AspNetCore.JsonPatch;
using Moq;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class ExpenseServiceTests : BaseTests
    {
        public ExpenseServiceTests()
        {
            PrepareInMemoryDatabase();
        }

        [Fact]
        public async Task MoveAsync_MoveExpenseToAnotherCategory_ShouldMoveExpense()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var sourceProject = await unitOfWork.ProjectRepository
                .Trackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                .FirstAsync(p => p.Id == this.project1.Id);

            var sourceCategory = sourceProject.Categories.First();
            var expenseToMove = sourceCategory.Expenses.First();
            var targetCategory = new Category(name: "Moved category");
            sourceProject.AddCategory(targetCategory);

            var saveProjectResponse = unitOfWork.ProjectRepository.InsertOrUpdate(sourceProject);
            saveProjectResponse.Succeeded.Should().BeTrue();
            await unitOfWork.CommitAsync();

            var moveResponse = await expenseService.MoveAsync(
                projectId: this.project1.Id,
                sourceCategoryId: sourceCategory.Id,
                expenseId: expenseToMove.Id,
                targetCategoryId: targetCategory.Id);

            moveResponse.Succeeded.Should().BeTrue();

            var refreshedProject = await unitOfWork.ProjectRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                .FirstAsync(p => p.Id == this.project1.Id);

            var refreshedSourceCategory = refreshedProject.Categories.First(c => c.Id == sourceCategory.Id);
            var refreshedTargetCategory = refreshedProject.Categories.First(c => c.Id == targetCategory.Id);

            refreshedSourceCategory.Expenses.Should().NotContain(e => e.Id == expenseToMove.Id);
            refreshedTargetCategory.Expenses.Should().Contain(e => e.Id == expenseToMove.Id);
        }

        [Fact]
        public async Task RemoveLinkAsync_RemoveUserSoleAdmin_ShouldRemoveLinkWithCreatedBy()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();
            var userManager = scopedServices.GetRequiredService<UserManager<User>>();

            // Arrange
            // Act
            await expenseService.RemoveLinkAsync(this.user1);

            // Assert
            var project = unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.CreatedBy)
                .First(p => p.Id == this.project2.Id);

            project.Categories.First().Expenses.First().CreatedBy.Id.Should().BeEmpty();
            project.Categories.First().Expenses.First().CreatorName.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task RemoveLinkAsync_RemoveOnlyViewerUser_ShouldRemoveLinkWithCreatedBy()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            // Act
            await expenseService.RemoveLinkAsync(this.user3);

            // Assert
            var project = unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.CreatedBy)
                .First(p => p.Id == this.project3.Id);

            project.Categories.First().Expenses.First().CreatedBy.Id.Should().BeEmpty();
            project.Categories.First().Expenses.First().CreatorName.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task RemoveLinkAsync_RemoveNotSoleAdminUser_ShouldRemoveLinkWithCreatedBy()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            // Act
            await expenseService.RemoveLinkAsync(this.user2);

            // Assert
            var project = unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.CreatedBy)
                .First(p => p.Id == this.project1.Id);

            project.Categories.First().Expenses.First().CreatedBy.Id.Should().BeEmpty();
            project.Categories.First().Expenses.First().CreatorName.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task CreateAsync_Exceeds100Percent_SendsNotification()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();

            var categoryId = this.project1.Categories.First().Id;
            var expenseDto = new ExpenseRequestDTO
            {
                Name = "Overbudget Expense",
                Amount = 150,
                Budget = 100,
                Date = DateOnly.FromDateTime(DateTime.UtcNow)
            };

            await expenseService.CreateAsync(this.user1, this.project1.Id, categoryId, expenseDto);

            notificationServiceMock.Verify(n => n.CreateNotificationAsync(It.Is<NotificationRequestDTO>(r => 
                r.CodeMessage == "BUDGET_OVERFLOW" && 
                r.Category == NotificationCategory.Finance)), Times.AtLeastOnce());
        }

        [Fact]
        public async Task CreateAsync_Crosses80Percent_SendsNotification()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();

            var categoryId = this.project1.Categories.First().Id;
            var expenseDto = new ExpenseRequestDTO
            {
                Name = "80% Budget Expense",
                Amount = 85,
                Budget = 100,
                Date = DateOnly.FromDateTime(DateTime.UtcNow)
            };

            await expenseService.CreateAsync(this.user1, this.project1.Id, categoryId, expenseDto);

            notificationServiceMock.Verify(n => n.CreateNotificationAsync(It.Is<NotificationRequestDTO>(r => 
                r.CodeMessage == "BUDGET_WARNING" && 
                r.Category == NotificationCategory.Finance)), Times.AtLeastOnce());
        }

        [Fact]
        public async Task UpdateAsync_Crosses80Percent_SendsNotification()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Create a fresh project, category and expense in this scope
            var project = new ProjectBuilder().AddName("Update Project").Build();
            unitOfWork.ProjectRepository.InsertOrUpdate(project);
            
            var category = new CategoryBuilder().AddName("Update Category").Build();
            project.AddCategory(category);
            unitOfWork.CategoryRepository.InsertOrUpdate(category);

            var expense = new ExpenseBuilder().AddName("Update Expense").AddCreatedBy(this.user1).Build();
            expense.SetItems(new List<ExpenseItem>()); // No items
            expense.SetBudget(100);
            expense.SetAmount(50);
            category.AddExpense(expense);
            unitOfWork.ExpenseRepository.InsertOrUpdate(expense);

            // Ensure user is linked to project
            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project).AddUser(this.user1).AddAccepted().Build());
            
            await unitOfWork.CommitAsync();

            var patch = new JsonPatchDocument<ExpenseRequestDTO>();
            patch.Replace(e => e.Amount, 85); // 85%

            var result = await expenseService.UpdateAsync(this.user1, project.Id, category.Id, expense.Id, patch);
            result.Succeeded.Should().BeTrue();

            notificationServiceMock.Verify(n => n.CreateNotificationAsync(It.Is<NotificationRequestDTO>(r => r.CodeMessage == "BUDGET_WARNING")), Times.AtLeastOnce());
        }

        [Fact]
        public async Task UpdateAsync_JumpsTo100Percent_SendsOnlyOverflowNotification()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Create a fresh project, category and expense in this scope
            var project = new ProjectBuilder().AddName("Jump Project").Build();
            unitOfWork.ProjectRepository.InsertOrUpdate(project);
            
            var category = new CategoryBuilder().AddName("Jump Category").Build();
            project.AddCategory(category);
            unitOfWork.CategoryRepository.InsertOrUpdate(category);

            var expense = new ExpenseBuilder().AddName("Jump Expense").AddCreatedBy(this.user1).Build();
            expense.SetItems(new List<ExpenseItem>()); // No items
            expense.SetBudget(100);
            expense.SetAmount(50);
            category.AddExpense(expense);
            unitOfWork.ExpenseRepository.InsertOrUpdate(expense);

            // Ensure user is linked to project
            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project).AddUser(this.user1).AddAccepted().Build());
            
            await unitOfWork.CommitAsync();

            notificationServiceMock.Invocations.Clear();

            var patch = new JsonPatchDocument<ExpenseRequestDTO>();
            patch.Replace(e => e.Amount, 110); // 110%

            await expenseService.UpdateAsync(this.user1, project.Id, category.Id, expense.Id, patch);

            notificationServiceMock.Verify(n => n.CreateNotificationAsync(It.Is<NotificationRequestDTO>(r => 
                r.CodeMessage == "BUDGET_OVERFLOW")), Times.AtLeastOnce());
            
            notificationServiceMock.Verify(n => n.CreateNotificationAsync(It.Is<NotificationRequestDTO>(r => 
                r.CodeMessage == "BUDGET_WARNING")), Times.Never());
        }

        [Fact]
        public async Task CreateAsync_BudgetIsZero_NoNotification()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();

            var categoryId = this.project1.Categories.First().Id;
            var expenseDto = new ExpenseRequestDTO
            {
                Name = "Zero Budget Expense",
                Amount = 150,
                Budget = 0,
                Date = DateOnly.FromDateTime(DateTime.UtcNow)
            };

            notificationServiceMock.Invocations.Clear();

            await expenseService.CreateAsync(this.user1, this.project1.Id, categoryId, expenseDto);

            notificationServiceMock.Verify(n => n.CreateNotificationAsync(It.IsAny<NotificationRequestDTO>()), Times.Never());
        }
    }
}
