using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.Authentication;
using EasyFinance.Server.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using Moq;
using Shouldly;

namespace EasyFinance.Server.Tests.Controllers
{
    public class AccessControlControllerBetaTesterTests : IDisposable
    {
        private const string BetaTesterAdminKeyEnvironmentVariable = "EconoFlow_BETA_TESTER_ADMIN_KEY";
        private readonly string? previousEnvValue;
        private readonly Mock<UserManager<User>> userManagerMock;
        private readonly AccessControlController controller;

        public AccessControlControllerBetaTesterTests()
        {
            this.previousEnvValue = Environment.GetEnvironmentVariable(BetaTesterAdminKeyEnvironmentVariable);

#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            var userStoreMock = new Mock<IUserStore<User>>();
            this.userManagerMock = new Mock<UserManager<User>>(
                userStoreMock.Object,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);

            var signInManagerMock = new Mock<SignInManager<User>>(
                this.userManagerMock.Object,
                Mock.Of<IHttpContextAccessor>(),
                Mock.Of<IUserClaimsPrincipalFactory<User>>(),
                null,
                null,
                null,
                null);
#pragma warning restore CS8625 // Cannot convert null literal to non-nullable reference type.

            this.controller = new AccessControlController(
                userManager: this.userManagerMock.Object,
                signInManager: signInManagerMock.Object,
                emailSender: Mock.Of<IEmailSender<User>>(),
                userService: Mock.Of<IUserService>(),
                linkGenerator: Mock.Of<LinkGenerator>(),
                accessControlService: Mock.Of<IAccessControlService>(),
                featureRolloutService: Mock.Of<IFeatureRolloutService>(),
                tokenSettings: new TokenSettings { SecretKey = Guid.NewGuid().ToString() },
                notificationService: Mock.Of<INotificationService>(),
                logger: Mock.Of<ILogger<AccessControlController>>());
        }

        [Fact]
        public async Task SetBetaTesterAsync_WhenAdminKeyIsNotConfigured_ShouldReturnForbidden()
        {
            // Arrange
            Environment.SetEnvironmentVariable(BetaTesterAdminKeyEnvironmentVariable, null);

            // Act
            var result = await this.controller.SetBetaTesterAsync(Guid.NewGuid(), true, "any-key");

            // Assert
            var statusCodeResult = result.ShouldBeOfType<StatusCodeResult>();
            statusCodeResult.StatusCode.ShouldBe(StatusCodes.Status403Forbidden);
        }

        [Fact]
        public async Task SetBetaTesterAsync_WhenAdminKeyIsInvalid_ShouldReturnForbidden()
        {
            // Arrange
            Environment.SetEnvironmentVariable(BetaTesterAdminKeyEnvironmentVariable, "correct-key");

            // Act
            var result = await this.controller.SetBetaTesterAsync(Guid.NewGuid(), true, "invalid-key");

            // Assert
            var statusCodeResult = result.ShouldBeOfType<StatusCodeResult>();
            statusCodeResult.StatusCode.ShouldBe(StatusCodes.Status403Forbidden);
        }

        [Fact]
        public async Task SetBetaTesterAsync_WhenAdminKeyIsValidAndEnabledIsTrue_ShouldAddRoleAndReturnNoContent()
        {
            // Arrange
            Environment.SetEnvironmentVariable(BetaTesterAdminKeyEnvironmentVariable, "correct-key");

            var userId = Guid.NewGuid();
            var user = new User(firstName: "Beta", lastName: "User", enabled: true)
            {
                Id = userId
            };

            this.userManagerMock.Setup(x => x.FindByIdAsync(userId.ToString())).ReturnsAsync(user);
            this.userManagerMock.Setup(x => x.IsInRoleAsync(user, SystemRoles.BetaTester)).ReturnsAsync(false);
            this.userManagerMock.Setup(x => x.AddToRoleAsync(user, SystemRoles.BetaTester)).ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await this.controller.SetBetaTesterAsync(userId, true, "correct-key");

            // Assert
            result.ShouldBeOfType<NoContentResult>();
            this.userManagerMock.Verify(x => x.AddToRoleAsync(user, SystemRoles.BetaTester), Times.Once);
        }

        public void Dispose()
        {
            Environment.SetEnvironmentVariable(BetaTesterAdminKeyEnvironmentVariable, this.previousEnvValue);
        }
    }
}
