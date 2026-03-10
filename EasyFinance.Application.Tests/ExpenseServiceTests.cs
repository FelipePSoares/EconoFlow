using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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
    }
}
