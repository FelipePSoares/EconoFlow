using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Infrastructure;
using FluentAssertions;
using Moq;

namespace EasyFinance.Application.Tests
{
    public class IncomeServiceTests
    {
        private readonly IncomeService IncomeService;
        private readonly Mock<IGenericRepository<Project>> ProjectRepository;
        private Mock<IGenericRepository<Income>> IncomeRepository;

        public IncomeServiceTests()
        {
            var unitOfWork = new Mock<IUnitOfWork>();
            this.ProjectRepository = new Mock<IGenericRepository<Project>>();
            unitOfWork.Setup(uw => uw.ProjectRepository).Returns(this.ProjectRepository.Object);
            this.IncomeRepository = new Mock<IGenericRepository<Income>>();
            unitOfWork.Setup(uw => uw.IncomeRepository).Returns(this.IncomeRepository.Object);

            this.IncomeService = new IncomeService(unitOfWork.Object);
        }

        [Fact]
        public async Task CreateAsync_WithDefaultIncome_ShouldThrowException()
        {
            // Arrange
            var user = new User();
            var projectId = Guid.NewGuid();
            Income income = default;

            var expectedMessage = string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "income") + " (Parameter 'income')";

            // Act
            Func<Task> func = async () => await this.IncomeService.CreateAsync(user, projectId, income);

            // Assert
            await func.Should().ThrowExactlyAsync<ArgumentNullException>()
                .WithMessage(expectedMessage);
        }

        [Fact]
        public async Task CreateAsync_WithDefaultUser_ShouldThrowException()
        {
            // Arrange
            User user = default;
            var projectId = Guid.NewGuid();
            var income = new Income();

            var expectedMessage = string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "user") + " (Parameter 'user')";

            // Act
            Func<Task> func = async () => await this.IncomeService.CreateAsync(user, projectId, income);

            // Assert
            await func.Should().ThrowExactlyAsync<ArgumentNullException>()
                .WithMessage(expectedMessage);
        }
    }
}