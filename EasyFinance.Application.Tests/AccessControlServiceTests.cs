using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Mappers;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace EasyFinance.Application.Tests
{
    public class AccessControlServiceTests
    {
        private readonly AccessControlService accessControlService;
        private readonly Mock<IUnitOfWork> unitOfWork;
        private readonly Mock<IGenericRepository<UserProject>> userProjectRepository;
        private readonly Mock<IGenericRepository<Project>> ProjectRepository;
        private readonly Mock<IEmailSender> emailSender;
        private readonly Mock<ILogger<AccessControlService>> logger;
        private readonly Mock<IUserStore<User>> userStoreMock;
        private readonly Mock<UserManager<User>> userManagerMock;

        public AccessControlServiceTests()
        {
            this.unitOfWork = new Mock<IUnitOfWork>();
            this.userProjectRepository = new Mock<IGenericRepository<UserProject>>();
            this.ProjectRepository = new Mock<IGenericRepository<Project>>();
            this.emailSender = new Mock<IEmailSender>();
            this.logger = new Mock<ILogger<AccessControlService>>();

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

            this.accessControlService = new AccessControlService(unitOfWork.Object, this.userManagerMock.Object, this.emailSender.Object, this.logger.Object);

            this.userProjectRepository.Setup(upr => upr.InsertOrUpdate(It.IsAny<UserProject>()))
                .Returns((UserProject up) => AppResponse<UserProject>.Success(up));
            this.unitOfWork.Setup(u => u.GetAffectedUsers(It.IsAny<EntityState[]>())).Returns([]);
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
            this.userManagerMock.Setup(u => u.FindByIdAsync(It.Is<string>(a => a == userTest.Id.ToString()))).ReturnsAsync(userTest);

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

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { new Project(projectId) }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(user, projectId, userProjectDto);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data.Should().HaveCount(2);
            result.Data.Last().UserName.Should().Be(userTest.FullName);
        }

        [Fact]
        public async Task UpdateAccessAsync_AddExistentUserByEmail_ShouldReturnSuccess()
        {
            // Arrange
            var inviterUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("inviter@example.com")
                .AddFirstName("Inviter")
                .AddLastName("User")
                .Build();

            var existingUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("existinguser@example.com")
                .AddFirstName("Existing")
                .AddLastName("User")
                .Build();

            this.userManagerMock.Setup(u => u.FindByIdAsync(It.Is<string>(u => u == inviterUser.Id.ToString()))).ReturnsAsync(inviterUser);
            this.userManagerMock.Setup(u => u.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync(existingUser);

            var project = new ProjectBuilder()
                .AddId(Guid.NewGuid())
                .AddName("Project A")
                .Build();

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>().Add(up => up, new UserProjectRequestDTO() { UserEmail = existingUser.Email, Role = Role.Manager });
            var userProjectAuthorization = new List<UserProject>
            {
                new UserProject(inviterUser, project, Role.Admin)
            };
            var userProjects = new List<UserProject>
            {
                new UserProject(inviterUser, project, Role.Admin)
            };

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { project }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(inviterUser, project.Id, userProjectDto);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data.Should().HaveCount(1);
            result.Data.Last().UserName.Should().Be(existingUser.FullName);
        }

        [Fact]
        public async Task UpdateAccessAsync_AddNotExistentUserByEmail_ShouldReturnSuccess()
        {
            // Arrange
            var inviterUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("inviter@example.com")
                .AddFirstName("Inviter")
                .AddLastName("User")
                .Build();

            var project = new ProjectBuilder()
                .AddId(Guid.NewGuid())
                .AddName("Project A")
                .Build();

            this.userManagerMock.Setup(u => u.FindByIdAsync(It.Is<string>(a => a == inviterUser.Id.ToString()))).ReturnsAsync(inviterUser);

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>().Add(up => up, new UserProjectRequestDTO() { UserEmail = "test@test.dev", Role = Role.Manager });
            var userProjectAuthorization = new List<UserProject>
            {
                new UserProject(inviterUser, project, Role.Admin)
            };
            var userProjects = new List<UserProject>
            {
                new UserProject(inviterUser, project, Role.Admin),
                new UserProject(new User { Id = Guid.NewGuid() }, project, Role.Viewer)
            };

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { project }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(inviterUser, project.Id, userProjectDto);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data.Should().HaveCount(2);
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

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { new Project(projectId) }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(user, projectId, userProjectDto);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Should().BeEquivalentTo(userProjects.ToDTO());
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

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { new Project(projectId) }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());

            // Act
            var action = async () => await this.accessControlService.UpdateAccessAsync(user, projectId, userProjectDto);

            // Assert
            await action.Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task SendEmailsAsync_InvitesNewUsers_ShouldSendEmails()
        {
            // Arrange
            var inviterUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("inviter@example.com")
                .AddFirstName("Inviter")
                .AddLastName("User")
                .Build();

            this.userManagerMock.Setup(u => u.FindByIdAsync(It.IsAny<string>())).ReturnsAsync(inviterUser);

            var project = new ProjectBuilder()
                .AddId(Guid.NewGuid())
                .AddName("Project A")
                .Build();

            var userProjectAuthorization = new List<UserProject>
            {
                new UserProjectBuilder().AddUser(inviterUser).AddProject(project).AddRole(Role.Admin).AddAccepted().Build()
            };

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { project }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjectAuthorization.AsQueryable());
            this.unitOfWork.Setup(u => u.GetAffectedUsers(It.IsAny<EntityState[]>())).Returns([]);

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>()
                .Add(up => up, new UserProjectRequestDTO() 
                { 
                    UserEmail = "newuser@example.com",
                    Role = Role.Viewer 
                });

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(inviterUser, project.Id, userProjectDto);

            // Assert
            this.emailSender.Verify(es => es.SendEmailAsync(
                "newuser@example.com",
                "You have received an invitation",
                It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task SendEmailsAsync_UpdateExistingUserGrant_ShouldSendEmails()
        {
            // Arrange
            var inviterUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("inviter@example.com")
                .AddFirstName("Inviter")
                .AddLastName("User")
                .Build();

            var existingUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("existinguser@example.com")
                .AddFirstName("Existing")
                .AddLastName("User")
                .Build();

            this.userManagerMock.Setup(u => u.FindByIdAsync(It.Is<string>(u => u == inviterUser.Id.ToString()))).ReturnsAsync(inviterUser);
            this.userManagerMock.Setup(u => u.FindByIdAsync(It.Is<string>(u => u == existingUser.Id.ToString()))).ReturnsAsync(existingUser);

            var project = new ProjectBuilder()
                .AddId(Guid.NewGuid())
                .AddName("Project A")
                .Build();

            var userProjectAuthorization = new List<UserProject>
            {
                new UserProjectBuilder().AddUser(inviterUser).AddProject(project).AddRole(Role.Admin).AddAccepted().Build(),
                new UserProjectBuilder().AddUser(existingUser).AddProject(project).AddRole(Role.Viewer).AddAccepted().Build()
            };

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { project }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjectAuthorization.AsQueryable());
            this.unitOfWork.Setup(u => u.GetAffectedUsers(It.IsAny<EntityState[]>())).Returns([existingUser.Id]);

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>()
                .Replace(up => up[0], new UserProjectRequestDTO()
                {
                    UserId = existingUser.Id,
                    Role = Role.Manager
                });

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(inviterUser, project.Id, userProjectDto);

            // Assert
            this.emailSender.Verify(es => es.SendEmailAsync(
                "existinguser@example.com",
                "Your grant access level has been changed",
                It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task SendEmailsAsync_AddExistingUser_ShouldSendEmails()
        {
            // Arrange
            var inviterUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("inviter@example.com")
                .AddFirstName("Inviter")
                .AddLastName("User")
                .Build();

            var existingUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("existinguser@example.com")
                .AddFirstName("Existing")
                .AddLastName("User")
                .Build();

            this.userManagerMock.Setup(u => u.FindByIdAsync(It.Is<string>(u => u == inviterUser.Id.ToString()))).ReturnsAsync(inviterUser);
            this.userManagerMock.Setup(u => u.FindByIdAsync(It.Is<string>(u => u == existingUser.Id.ToString()))).ReturnsAsync(existingUser);

            var project = new ProjectBuilder()
                .AddId(Guid.NewGuid())
                .AddName("Project A")
                .Build();

            var userProjectAuthorization = new List<UserProject>
            {
                new UserProjectBuilder().AddUser(inviterUser).AddProject(project).AddRole(Role.Admin).AddAccepted().Build()
            };

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { project }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjectAuthorization.AsQueryable());
            this.unitOfWork.Setup(u => u.GetAffectedUsers(It.IsAny<EntityState[]>())).Returns([existingUser.Id]);

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>()
                .Add(up => up, new UserProjectRequestDTO()
                {
                    UserId = existingUser.Id,
                    Role = Role.Manager
                });

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(inviterUser, project.Id, userProjectDto);

            // Assert
            this.emailSender.Verify(es => es.SendEmailAsync(
                "existinguser@example.com",
                "You have been granted access to a project",
                It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task SendEmailsAsync_EmailSenderThrowsException_ShouldLogError()
        {
            // Arrange
            var inviterUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("inviter@example.com")
                .AddFirstName("Inviter")
                .AddLastName("User")
                .Build();

            this.userManagerMock.Setup(u => u.FindByIdAsync(It.IsAny<string>())).ReturnsAsync(inviterUser);

            var project = new ProjectBuilder()
                .AddId(Guid.NewGuid())
                .AddName("Project A")
                .Build();

            var userProjectAuthorization = new List<UserProject>
            {
                new UserProjectBuilder().AddUser(inviterUser).AddProject(project).AddRole(Role.Admin).AddAccepted().Build()
            };

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { project }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjectAuthorization.AsQueryable());
            this.unitOfWork.Setup(u => u.GetAffectedUsers(It.IsAny<EntityState[]>())).Returns([]);

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>()
                .Add(up => up, new UserProjectRequestDTO()
                {
                    UserEmail = "newuser@example.com",
                    Role = Role.Viewer
                });

            this.emailSender.Setup(es => es.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("Email sending failed"));

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(inviterUser, project.Id, userProjectDto);

            // Assert
            this.logger.Verify(l => l.Log(LogLevel.Error, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.Is<Exception>(e => e.Message == "Email sending failed"), It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
        }

        [Fact]
        public async Task UpdateAccessAsync_AddDuplicateUserByEmail_ShouldReturnFalse()
        {
            // Arrange
            var inviterUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("inviter@example.com")
                .AddFirstName("Inviter")
                .AddLastName("User")
                .Build();

            var existingUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("existinguser@example.com")
                .AddFirstName("Existing")
                .AddLastName("User")
                .Build();

            this.userManagerMock.Setup(u => u.FindByIdAsync(It.Is<string>(u => u == inviterUser.Id.ToString()))).ReturnsAsync(inviterUser);
            this.userManagerMock.Setup(u => u.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync(existingUser);

            var project = new ProjectBuilder()
                .AddId(Guid.NewGuid())
                .AddName("Project A")
                .Build();

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>().Add(up => up, new UserProjectRequestDTO() { UserEmail = existingUser.Email, Role = Role.Manager });
            var userProjectAuthorization = new List<UserProject>
            {
                new UserProject(inviterUser, project, Role.Admin)
            };
            var userProjects = new List<UserProject>
            {
                new UserProject(inviterUser, project, Role.Admin),
                new UserProject(existingUser, project, Role.Viewer)
            };

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { project }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(inviterUser, project.Id, userProjectDto);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.Should().ContainSingle(e => e.Code == "User" && e.Description == ValidationMessages.DuplicateUser);
        }

        [Fact]
        public async Task UpdateAccessAsync_AddDuplicateNotExistentUserByEmail_ShouldReturnFalse()
        {
            // Arrange
            var inviterUser = new UserBuilder()
                .AddId(Guid.NewGuid())
                .AddEmail("inviter@example.com")
                .AddFirstName("Inviter")
                .AddLastName("User")
                .Build();

            var project = new ProjectBuilder()
                .AddId(Guid.NewGuid())
                .AddName("Project A")
                .Build();

            this.userManagerMock.Setup(u => u.FindByIdAsync(It.Is<string>(a => a == inviterUser.Id.ToString()))).ReturnsAsync(inviterUser);

            var userProjectDto = new JsonPatchDocument<IList<UserProjectRequestDTO>>().Add(up => up, new UserProjectRequestDTO() { UserEmail = "test@test.dev", Role = Role.Manager });
            var userProjectAuthorization = new List<UserProject>
            {
                new UserProject(inviterUser, project, Role.Admin)
            };
            var userProjects = new List<UserProject>
            {
                new UserProject(inviterUser, project, Role.Admin),
                new UserProject(new User { Id = Guid.NewGuid() }, project, Role.Viewer),
                new UserProject(null, project, Role.Viewer, "test@test.dev")
            };

            this.ProjectRepository.Setup(pr => pr.Trackable()).Returns(new List<Project> { project }.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.NoTrackable()).Returns(userProjectAuthorization.AsQueryable());
            this.userProjectRepository.Setup(upr => upr.Trackable()).Returns(userProjects.AsQueryable());

            // Act
            var result = await this.accessControlService.UpdateAccessAsync(inviterUser, project.Id, userProjectDto);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.Should().ContainSingle(e => e.Code == "User" && e.Description == ValidationMessages.DuplicateUser);
        }
    }
}