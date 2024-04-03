using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.FinancialProject;
using FluentAssertions;
using Moq;

namespace EasyFinance.Application.Tests
{
    public class AccessControlServiceTests
    {
        private readonly AccessControlService accessControlService;
        private readonly Mock<IGenericRepository<UserProject>> userProjectRepository;

        public AccessControlServiceTests()
        {
            var unitOfWork = new Mock<IUnitOfWork>();
            this.userProjectRepository = new Mock<IGenericRepository<UserProject>>();
            unitOfWork.Setup(uw => uw.UserProjectRepository).Returns(this.userProjectRepository.Object);

            this.accessControlService = new AccessControlService(unitOfWork.Object);
        }

        [Fact]
        public void HasAuthorization_AccessNotExistent_ShouldReturnFalse()
        {
            // Arrange
            // Act
            var result = this.accessControlService.HasAuthorization(Guid.NewGuid(), Guid.NewGuid(), Role.Admin);

            // Assert
            result.Should().BeFalse();
        }

        [Theory]
        [InlineData(Role.Viewer, Role.Manager)]
        [InlineData(Role.Viewer, Role.Admin)]
        [InlineData(Role.Manager, Role.Admin)]
        public void HasAuthorization_NeedHigherAccess_ShouldReturnFalse(Role role, Role roleNeeded)
        {
            // Arrange
            var userId = Guid.NewGuid();
            var projectId = Guid.NewGuid();

            var accessNeeded = new List<UserProject>()
            {
                new UserProject(new User() { Id = userId }, new Project(projectId), role)
            };

            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(accessNeeded.AsQueryable());

            // Act
            var result = this.accessControlService.HasAuthorization(userId, projectId, roleNeeded);

            // Assert
            result.Should().BeFalse();
        }

        [Theory]
        [InlineData(Role.Viewer, Role.Viewer)]
        [InlineData(Role.Manager, Role.Viewer)]
        [InlineData(Role.Manager, Role.Manager)]
        [InlineData(Role.Admin, Role.Viewer)]
        [InlineData(Role.Admin, Role.Manager)]
        [InlineData(Role.Admin, Role.Admin)]
        public void HasAuthorization_HasAccess_ShouldReturnTrue(Role role, Role roleNeeded)
        {
            // Arrange
            var userId = Guid.NewGuid();
            var projectId = Guid.NewGuid();

            var accessNeeded = new List<UserProject>()
            {
                new UserProject(new User() { Id = userId }, new Project(projectId), role)
            };

            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(accessNeeded.AsQueryable());

            // Act
            var result = this.accessControlService.HasAuthorization(userId, projectId, roleNeeded);

            // Assert
            result.Should().BeTrue();
        }
    }
}