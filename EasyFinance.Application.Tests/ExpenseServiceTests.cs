using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.AccessControl;
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
