using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using FluentAssertions;
using Microsoft.AspNetCore.JsonPatch;
using Moq;

namespace EasyFinance.Application.Tests
{
    public class AccessControlServiceTests
    {
        private readonly AccessControlService accessControlService;
        private readonly Mock<IGenericRepository<UserProject>> userProjectRepository;
        private readonly Mock<IGenericRepository<Project>> ProjectRepository;

        public AccessControlServiceTests()
        {
            var unitOfWork = new Mock<IUnitOfWork>();
            this.userProjectRepository = new Mock<IGenericRepository<UserProject>>();
            this.ProjectRepository = new Mock<IGenericRepository<Project>>();

            unitOfWork.Setup(uw => uw.UserProjectRepository).Returns(this.userProjectRepository.Object);
            unitOfWork.Setup(uw => uw.ProjectRepository).Returns(this.ProjectRepository.Object);

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

        [Fact]
        public async Task UpdateAccessAsync_ValidPatch_ShouldReturnSuccess()
        {
            // Arrange
            var user = new User() { Id = Guid.NewGuid() };
            var projectId = Guid.NewGuid();
            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>().Add(up => up, new UserProjectRequestDTO() { UserId = Guid.NewGuid(), Role = Role.Manager});
            var userProjectAuthorization = new List<UserProject>
            {
                new UserProject(user, new Project(projectId), Role.Admin)
            };
            var userProjects = new List<UserProject>
            {
                new UserProject(user, new Project(projectId), Role.Admin),
                new UserProject(new User { Id = Guid.NewGuid() }, new Project(projectId), Role.Viewer)
            };

            this.ProjectRepository.Setup(pr => pr.NoTrackable()).Returns(new List<Project> { new Project(projectId) }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.InsertOrUpdate(It.IsAny<UserProject>())).Returns((UserProject up) => up);

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(user, projectId, userProjectDto);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data.Should().HaveCount(3);
        }

        [Fact]
        public async Task UpdateAccessAsync_EmptyPatch_ShouldReturnSuccess()
        {
            // Arrange
            var user = new User() { Id = Guid.NewGuid() };
            var projectId = Guid.NewGuid();
            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>();
            var userProjectAuthorization = new List<UserProject>
            {
                new UserProject(user, new Project(projectId), Role.Admin)
            };
            var userProjects = new List<UserProject>
            {
                new UserProject(new User { Id = Guid.NewGuid() }, new Project(projectId), Role.Viewer)
            };

            this.ProjectRepository.Setup(pr => pr.NoTrackable()).Returns(new List<Project> { new Project(projectId) }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(user, projectId, userProjectDto);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Should().BeEquivalentTo(userProjects.ToDTO());
        }

        [Fact]
        public async Task UpdateAccessAsync_NoAdminUserInProject_ShouldReturnFalse()
        {
            // Arrange
            var user = new User() { Id = Guid.NewGuid() };
            var projectId = Guid.NewGuid();
            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>().Add(up => up, new UserProjectRequestDTO() { UserId = Guid.NewGuid(), Role = Role.Manager });
            var userProjectAuthorization = new List<UserProject>
            {
                new UserProject(user, new Project(projectId), Role.Admin)
            };
            var userProjects = new List<UserProject>
            {
                new UserProject(new User { Id = Guid.NewGuid() }, new Project(projectId), Role.Viewer)
            };

            this.ProjectRepository.Setup(pr => pr.NoTrackable()).Returns(new List<Project> { new Project(projectId) }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.InsertOrUpdate(It.IsAny<UserProject>())).Returns((UserProject up) => up);

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(user, projectId, userProjectDto);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.Should().ContainSingle(e => e.Code == "General" && e.Description == ValidationMessages.AdminRequired);
        }

        [Fact]
        public async Task UpdateAccessAsync_UserHasNoAuthorization_ShouldReturnSuccess()
        {
            // Arrange
            var user = new User() { Id = Guid.NewGuid() };
            var projectId = Guid.NewGuid();
            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>();
            var userProjectAuthorization = new List<UserProject>
            {
            };
            var userProjects = new List<UserProject>
            {
                new UserProject(new User { Id = Guid.NewGuid() }, new Project(projectId), Role.Viewer)
            };

            this.ProjectRepository.Setup(pr => pr.NoTrackable()).Returns(new List<Project> { new Project(projectId) }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(user, projectId, userProjectDto);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.Should().ContainSingle(e => e.Code == ValidationMessages.Forbidden && e.Description == ValidationMessages.Forbidden);
        }
    }
}