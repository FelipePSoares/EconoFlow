using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Server.Controllers;
using FpsSoftware.Chassis;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Moq;
using Shouldly;
using Xunit;

namespace EasyFinance.Server.Tests.Controllers
{
    /// <summary>
    /// Guards the HTTP contract of <c>DELETE api/Projects/{projectId}/access/{userProjectId}</c>.
    /// That route used to answer 500 (NullReferenceException) when the target membership was a
    /// pending invitation, and the project id was not forwarded to the service.
    /// </summary>
    public class ProjectsControllerDeleteAccessTests
    {
        private readonly Mock<IProjectService> projectService = new();
        private readonly Mock<ICategoryService> categoryService = new();
        private readonly Mock<IIncomeService> incomeService = new();
        private readonly Mock<IAccessControlService> accessControlService = new();
        private readonly Mock<UserManager<User>> userManagerMock;
        private readonly ProjectsController controller;
        private readonly User user;
        private readonly Guid projectId = Guid.NewGuid();
        private readonly Guid userProjectId = Guid.NewGuid();

        public ProjectsControllerDeleteAccessTests()
        {
            this.user = new UserBuilder().AddEmail("admin@econoflow.test").Build();

#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            this.userManagerMock = new Mock<UserManager<User>>(
                new Mock<IUserStore<User>>().Object,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
#pragma warning restore CS8625 // Cannot convert null literal to non-nullable reference type.

            this.userManagerMock
                .Setup(manager => manager.GetUserAsync(It.IsAny<ClaimsPrincipal>()))
                .ReturnsAsync(this.user);

            this.controller = new ProjectsController(
                this.projectService.Object,
                this.categoryService.Object,
                this.incomeService.Object,
                this.accessControlService.Object,
                this.userManagerMock.Object)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new List<Claim>
                        {
                            new(ClaimTypes.NameIdentifier, this.user.Id.ToString())
                        }))
                    }
                }
            };
        }

        [Fact]
        public async Task DeleteUserProjectAsync_AdminWithPendingInvitation_ShouldReturnOkAndNotThrow()
        {
            // Arrange
            this.accessControlService
                .Setup(service => service.HasAuthorization(this.user.Id, this.projectId, Role.Admin))
                .Returns(true);
            this.accessControlService
                .Setup(service => service.RemoveAccessAsync(this.projectId, this.userProjectId))
                .ReturnsAsync(AppResponse.Success());

            // Act
            var result = await this.controller.DeleteUserProjectAsync(this.projectId, this.userProjectId);

            // Assert
            result.ShouldBeAssignableTo<IStatusCodeActionResult>().StatusCode.ShouldBe(StatusCodes.Status200OK);
            this.accessControlService.Verify(
                service => service.RemoveAccessAsync(this.projectId, this.userProjectId),
                Times.Once);
        }

        [Fact]
        public async Task DeleteUserProjectAsync_ShouldForwardProjectIdToTheService()
        {
            // Arrange: this is the regression guard - the project id must reach the service so the
            // deletion can be scoped to the project the caller proved admin rights on.
            this.accessControlService
                .Setup(service => service.HasAuthorization(this.user.Id, this.projectId, Role.Admin))
                .Returns(true);
            this.accessControlService
                .Setup(service => service.RemoveAccessAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
                .ReturnsAsync(AppResponse.Success());

            // Act
            await this.controller.DeleteUserProjectAsync(this.projectId, this.userProjectId);

            // Assert
            this.accessControlService.Verify(
                service => service.RemoveAccessAsync(this.projectId, this.userProjectId),
                Times.Once);
        }

        [Fact]
        public async Task DeleteUserProjectAsync_UserIsNotAdmin_ShouldThrowUnauthorizedAccessException()
        {
            // Arrange
            this.accessControlService
                .Setup(service => service.HasAuthorization(this.user.Id, this.projectId, Role.Admin))
                .Returns(false);

            // Act
            var action = async () => await this.controller.DeleteUserProjectAsync(this.projectId, this.userProjectId);

            // Assert
            await Should.ThrowAsync<UnauthorizedAccessException>(action);
            this.accessControlService.Verify(
                service => service.RemoveAccessAsync(It.IsAny<Guid>(), It.IsAny<Guid>()),
                Times.Never);
        }
    }
}
