using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class IncomeServiceTests : BaseTests
    {
        private readonly IncomeService IncomeService;
        private readonly Mock<IGenericRepository<Project>> ProjectRepository;
        private readonly Mock<IGenericRepository<Income>> IncomeRepository;

        public IncomeServiceTests()
        {
            var unitOfWork = new Mock<IUnitOfWork>();
            this.ProjectRepository = new Mock<IGenericRepository<Project>>();
            unitOfWork.Setup(uw => uw.ProjectRepository).Returns(this.ProjectRepository.Object);
            this.IncomeRepository = new Mock<IGenericRepository<Income>>();
            unitOfWork.Setup(uw => uw.IncomeRepository).Returns(this.IncomeRepository.Object);

            this.IncomeService = new IncomeService(unitOfWork.Object, new Mock<ILogger<IncomeService>>().Object);

            PrepareInMemoryDatabase();
        }

        [Fact]
        public async Task CreateAsync_WithDefaultIncome_ShouldThrowException()
        {
            // Arrange
            var user = new User();
            var projectId = Guid.NewGuid();
            Income? income = default;

            // Act
            var result = await IncomeService.CreateAsync(user, projectId, income);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.Should().HaveCount(1);
            result.Messages.First().Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(income)));
        }

        [Fact]
        public async Task CreateAsync_WithDefaultUser_ShouldThrowException()
        {
            // Arrange
            User? user = default;
            var projectId = Guid.NewGuid();
            var income = new Income();

            // Act
            var result = await IncomeService.CreateAsync(user, projectId, income);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.Should().HaveCount(1);
            result.Messages.First().Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));
        }

        [Fact]
        public async Task RemoveLinkAsync_RemoveUserSoleAdmin_ShouldRemoveLinkWithCreatedBy()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var incomeService = scopedServices.GetRequiredService<IIncomeService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();
            var userManager = scopedServices.GetRequiredService<UserManager<User>>();

            // Arrange
            // Act
            await incomeService.RemoveLinkAsync(this.user1);

            // Assert
            var project = unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Incomes)
                    .ThenInclude(e => e.CreatedBy)
                .First(p => p.Id == this.project1.Id);

            project.Incomes.First().CreatedBy.Id.Should().BeEmpty();
            project.Incomes.First().CreatorName.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task RemoveLinkAsync_RemoveOnlyViewerUser_ShouldRemoveLinkWithCreatedBy()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var incomeService = scopedServices.GetRequiredService<IIncomeService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            // Act
            await incomeService.RemoveLinkAsync(this.user3);

            // Assert
            var project = unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Incomes)
                    .ThenInclude(e => e.CreatedBy)
                .First(p => p.Id == this.project3.Id);

            project.Incomes.First().CreatedBy.Id.Should().BeEmpty();
            project.Incomes.First().CreatorName.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task RemoveLinkAsync_RemoveNotSoleAdminUser_ShouldRemoveLinkWithCreatedBy()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var incomeService = scopedServices.GetRequiredService<IIncomeService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            // Act
            await incomeService.RemoveLinkAsync(this.user2);

            // Assert
            var project = unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Incomes)
                    .ThenInclude(e => e.CreatedBy)
                .First(p => p.Id == this.project2.Id);

            project.Incomes.First().CreatedBy.Id.Should().BeEmpty();
            project.Incomes.First().CreatorName.Should().NotBeNullOrEmpty();
        }
    }
}