using System.Net;
using System.Security.Claims;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Server.MiddleWare;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;

namespace EasyFinance.Server.Tests
{
    public class AuthorizationMiddlewareTests
    {
        private readonly Mock<RequestDelegate> requestDelegateMock;
        private readonly ProjectAuthorizationMiddleware projectAuthorization;
        private readonly Mock<IAccessControlService> accessControlService;
        private readonly Mock<IProjectService> projectService;
        private readonly Mock<HttpContext> httpContext;
        private readonly Mock<HttpRequest> httpRequest;
        private readonly Mock<HttpResponse> httpResponse;

        public AuthorizationMiddlewareTests()
        {
            this.accessControlService = new Mock<IAccessControlService>();
            this.projectService = new Mock<IProjectService>();

            this.httpContext = new Mock<HttpContext>();
            this.httpRequest = new Mock<HttpRequest>();
            this.httpResponse = new Mock<HttpResponse>();
            httpResponse.SetupSet(content => content.StatusCode = It.IsAny<int>()).Verifiable();
            httpContext.Setup(hc => hc.Request).Returns(httpRequest.Object);
            httpContext.Setup(hc => hc.Response).Returns(httpResponse.Object);

            this.requestDelegateMock = new Mock<RequestDelegate>();

            this.projectAuthorization = new ProjectAuthorizationMiddleware(this.requestDelegateMock.Object);
        }

        [Fact]
        public async Task InvokeAsync_NullRouteValues_ShouldPass()
        {
            // Arrange
            // Act
            await this.projectAuthorization.InvokeAsync(this.httpContext.Object, this.accessControlService.Object, this.projectService.Object);

            // Assert
            this.requestDelegateMock.Invocations.Count().Should().Be(1);
        }

        [Fact]
        public async Task InvokeAsync_RouteValuesWithoutProjectId_ShouldPass()
        {
            // Arrange
            var routeValues = new Dictionary<string, object?>()
            {
                { "Action", "GetById" },
                { "Controller", "Project" },
            };
            this.httpRequest.Setup(hr => hr.RouteValues).Returns(new Microsoft.AspNetCore.Routing.RouteValueDictionary(routeValues));

            // Act
            await this.projectAuthorization.InvokeAsync(this.httpContext.Object, this.accessControlService.Object, this.projectService.Object);

            // Assert
            this.requestDelegateMock.Invocations.Count().Should().Be(1);
        }

        [Fact]
        public async Task InvokeAsync_UserWithAccess_ShouldPass()
        {
            // Arrange
            var routeValues = new Dictionary<string, object?>()
            {
                { "Action", "GetById" },
                { "Controller", "Project" },
                { "ProjectId", "54993d43-1ddd-4d83-a05a-addca7fce71d" }
            };
            this.httpRequest.Setup(hr => hr.RouteValues).Returns(new Microsoft.AspNetCore.Routing.RouteValueDictionary(routeValues));

            var user = new ClaimsPrincipal(new ClaimsIdentity(new List<Claim>()
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
            }));
            this.httpContext.Setup(hc => hc.User).Returns(user);

            this.accessControlService.Setup(acs => acs.HasAuthorization(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Role>())).Returns(true);

            // Act
            await this.projectAuthorization.InvokeAsync(this.httpContext.Object, this.accessControlService.Object, this.projectService.Object);

            // Assert
            this.requestDelegateMock.Invocations.Count().Should().Be(1);
        }

        [Fact]
        public async Task InvokeAsync_WithoutUser_ShouldDenied()
        {
            // Arrange
            var routeValues = new Dictionary<string, object?>()
            {
                { "Action", "GetById" },
                { "Controller", "Project" },
                { "ProjectId", "54993d43-1ddd-4d83-a05a-addca7fce71d" }
            };
            this.httpRequest.Setup(hr => hr.RouteValues).Returns(new Microsoft.AspNetCore.Routing.RouteValueDictionary(routeValues));

            // Act
            await this.projectAuthorization.InvokeAsync(this.httpContext.Object, this.accessControlService.Object, this.projectService.Object);

            // Assert
            this.requestDelegateMock.Invocations.Count().Should().Be(0);
            this.httpResponse.VerifySet(content => content.StatusCode = It.Is<int>(sc => sc == (int)HttpStatusCode.Unauthorized));
        }

        [Fact]
        public async Task InvokeAsync_UserWithoutAccess_ShouldDenied()
        {
            // Arrange
            var routeValues = new Dictionary<string, object?>()
            {
                { "Action", "GetById" },
                { "Controller", "Project" },
                { "ProjectId", "54993d43-1ddd-4d83-a05a-addca7fce71d" }
            };
            this.httpRequest.Setup(hr => hr.RouteValues).Returns(new Microsoft.AspNetCore.Routing.RouteValueDictionary(routeValues));

            var user = new ClaimsPrincipal(new ClaimsIdentity(new List<Claim>()
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
            }));
            this.httpContext.Setup(hc => hc.User).Returns(user);

            // Act
            await this.projectAuthorization.InvokeAsync(this.httpContext.Object, this.accessControlService.Object, this.projectService.Object);

            // Assert
            this.requestDelegateMock.Invocations.Count().Should().Be(0);
            this.httpResponse.VerifySet(content => content.StatusCode = It.Is<int>(sc => sc == (int)HttpStatusCode.Forbidden));
        }

        [Fact]
        public async Task InvokeAsync_ProjectTypeCompany_ShouldPass()
        {
            // Arrange
            var routeValues = new Dictionary<string, object?>()
            {
                { "Action", "GetAll" },
                { "Controller", "Clients" },
                { "ProjectId", "54993d43-1ddd-4d83-a05a-addca7fce71d" }
            };
            this.httpRequest.Setup(hr => hr.RouteValues).Returns(new Microsoft.AspNetCore.Routing.RouteValueDictionary(routeValues));
            this.httpRequest.Setup(hr => hr.Path).Returns("/api/Projects/54993d43-1ddd-4d83-a05a-addca7fce71d/company/clients");

            var user = new ClaimsPrincipal(new ClaimsIdentity(new List<Claim>()
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
            }));
            this.httpContext.Setup(hc => hc.User).Returns(user);

            var userProject = new UserProjectResponseDTO()
            {
                Project = new ProjectResponseDTO()
                {
                    Type = Domain.FinancialProject.ProjectTypes.Company
                }
            };
            this.projectService.Setup(ps => ps.GetById(It.IsAny<Guid>(), It.IsAny<Guid>()))
                .Returns(AppResponse<UserProjectResponseDTO>.Success(userProject));

            this.accessControlService.Setup(acs => acs.HasAuthorization(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Role>())).Returns(true);

            // Act
            await this.projectAuthorization.InvokeAsync(this.httpContext.Object, this.accessControlService.Object, this.projectService.Object);

            // Assert
            this.requestDelegateMock.Invocations.Count().Should().Be(1);
        }

        [Fact]
        public async Task InvokeAsync_ProjectTypePersonal_ShouldDenied()
        {
            // Arrange
            var routeValues = new Dictionary<string, object?>()
            {
                { "Action", "GetAll" },
                { "Controller", "Clients" },
                { "ProjectId", "54993d43-1ddd-4d83-a05a-addca7fce71d" }
            };
            this.httpRequest.Setup(hr => hr.RouteValues).Returns(new Microsoft.AspNetCore.Routing.RouteValueDictionary(routeValues));
            this.httpRequest.Setup(hr => hr.Path).Returns("/api/Projects/54993d43-1ddd-4d83-a05a-addca7fce71d/company/clients");

            var user = new ClaimsPrincipal(new ClaimsIdentity(new List<Claim>()
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
            }));
            this.httpContext.Setup(hc => hc.User).Returns(user);

            var userProject = new UserProjectResponseDTO()
            {
                Project = new ProjectResponseDTO()
                {
                    Type = Domain.FinancialProject.ProjectTypes.Personal
                }
            };
            this.projectService.Setup(ps => ps.GetById(It.IsAny<Guid>(), It.IsAny<Guid>()))
                .Returns(AppResponse<UserProjectResponseDTO>.Success(userProject));

            this.accessControlService.Setup(acs => acs.HasAuthorization(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Role>())).Returns(true);

            // Act
            await this.projectAuthorization.InvokeAsync(this.httpContext.Object, this.accessControlService.Object, this.projectService.Object);

            // Assert
            this.requestDelegateMock.Invocations.Count().Should().Be(0);
            this.httpResponse.VerifySet(content => content.StatusCode = It.Is<int>(sc => sc == (int)HttpStatusCode.Forbidden));
        }

        [Fact]
        public async Task InvokeAsync_CantFindProject_ShouldDenied()
        {
            // Arrange
            var routeValues = new Dictionary<string, object?>()
            {
                { "Action", "GetAll" },
                { "Controller", "Clients" },
                { "ProjectId", "54993d43-1ddd-4d83-a05a-addca7fce71d" }
            };
            this.httpRequest.Setup(hr => hr.RouteValues).Returns(new Microsoft.AspNetCore.Routing.RouteValueDictionary(routeValues));
            this.httpRequest.Setup(hr => hr.Path).Returns("/api/Projects/54993d43-1ddd-4d83-a05a-addca7fce71d/company/clients");

            var user = new ClaimsPrincipal(new ClaimsIdentity(new List<Claim>()
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
            }));
            this.httpContext.Setup(hc => hc.User).Returns(user);

            this.projectService.Setup(ps => ps.GetById(It.IsAny<Guid>(), It.IsAny<Guid>()))
                .Returns(AppResponse<UserProjectResponseDTO>.Error("Project Not Found"));

            this.accessControlService.Setup(acs => acs.HasAuthorization(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Role>())).Returns(true);

            // Act
            await this.projectAuthorization.InvokeAsync(this.httpContext.Object, this.accessControlService.Object, this.projectService.Object);

            // Assert
            this.requestDelegateMock.Invocations.Count().Should().Be(0);
            this.httpResponse.VerifySet(content => content.StatusCode = It.Is<int>(sc => sc == (int)HttpStatusCode.Forbidden));
        }
    }
}