using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Mappers;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Moq;

namespace EasyFinance.Application.Tests
{
    public class AccessControlServiceTests
    {
        private readonly AccessControlService accessControlService;
        private readonly Mock<IGenericRepository<UserProject>> userProjectRepository;
        private readonly Mock<IGenericRepository<Project>> ProjectRepository;
        private readonly Mock<IUserStore<User>> userStoreMock;
        private readonly Mock<UserManager<User>> userManagerMock;

        public AccessControlServiceTests()
        {
            var unitOfWork = new Mock<IUnitOfWork>();
            this.userProjectRepository = new Mock<IGenericRepository<UserProject>>();
            this.ProjectRepository = new Mock<IGenericRepository<Project>>();

#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            this.userStoreMock = new Mock<IUserStore<User>>();

            this.userManagerMock = new Mock<UserManager<User>>(
                this.userStoreMock.Object,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
#pragma warning restore CS8625 // Cannot convert null literal to non-nullable reference type.

            unitOfWork.Setup(uw => uw.UserProjectRepository).Returns(this.userProjectRepository.Object);
            unitOfWork.Setup(uw => uw.ProjectRepository).Returns(this.ProjectRepository.Object);

            this.accessControlService = new AccessControlService(unitOfWork.Object, this.userManagerMock.Object);
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

            var userTest = new UserBuilder().AddId(Guid.NewGuid()).AddEmail("test@test.dev").AddFirstName("test").AddLastName("test").Build();
            this.userManagerMock.Setup(u => u.FindByIdAsync(It.IsAny<string>())).ReturnsAsync(userTest);

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>().Add(up => up, new UserProjectRequestDTO() { UserId = userTest.Id, Role = Role.Manager });
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
            result.Data.Last().UserName.Should().Be(userTest.FullName);
        }

        [Fact]
        public async Task UpdateAccessAsync_AddExistentUserByEmail_ShouldReturnSuccess()
        {
            // Arrange
            var user = new User() { Id = Guid.NewGuid() };
            var projectId = Guid.NewGuid();

            var userTest = new UserBuilder().AddId(Guid.NewGuid()).AddEmail("test@test.dev").AddFirstName("test").AddLastName("test").Build();
            this.userManagerMock.Setup(u => u.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync(userTest);

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>().Add(up => up, new UserProjectRequestDTO() { UserEmail = "test@test.dev", Role = Role.Manager });
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
            result.Data.Last().UserName.Should().Be(userTest.FullName);
        }

        [Fact]
        public async Task UpdateAccessAsync_AddNotExistentUserByEmail_ShouldReturnSuccess()
        {
            // Arrange
            var user = new User() { Id = Guid.NewGuid() };
            var projectId = Guid.NewGuid();

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>().Add(up => up, new UserProjectRequestDTO() { UserEmail = "test@test.dev", Role = Role.Manager });
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
            result.Data.Last().UserEmail.Should().Be("test@test.dev");
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