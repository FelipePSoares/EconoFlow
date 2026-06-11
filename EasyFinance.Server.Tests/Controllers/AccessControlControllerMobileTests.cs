using System.Security.Claims;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Application.Features.TurnstileService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.Authentication;
using EasyFinance.Server.Config;
using EasyFinance.Server.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Shouldly;

#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
namespace EasyFinance.Server.Tests.Controllers
{
    public class AccessControlControllerMobileTests
    {
        private const string correlationIdClaimType = "CorrelationId";

        private readonly User user;
        private readonly Mock<UserManager<User>> userManagerMock;
        private readonly Mock<SignInManager<User>> signInManagerMock;
        private readonly Mock<IAccessControlService> accessControlServiceMock;
        private readonly AccessControlController controller;
        private readonly TokenSettings tokenSettings;

        public AccessControlControllerMobileTests()
        {
            this.user = new User(firstName: "John", lastName: "Doe", enabled: true)
            {
                Id = Guid.NewGuid(),
                UserName = "john.doe@example.com",
                Email = "john.doe@example.com",
                EmailConfirmed = true
            };

            this.tokenSettings = new TokenSettings { SecretKey = Guid.NewGuid().ToString() };

            var userStoreMock = new Mock<IUserStore<User>>();
            this.userManagerMock = new Mock<UserManager<User>>(
                userStoreMock.Object,
                null, null, null, null, null, null, null, null);

            this.signInManagerMock = new Mock<SignInManager<User>>(
                this.userManagerMock.Object,
                Mock.Of<IHttpContextAccessor>(),
                Mock.Of<IUserClaimsPrincipalFactory<User>>(),
                null, null, null, null);

            this.accessControlServiceMock = new Mock<IAccessControlService>();

            this.controller = new AccessControlController(
                userManager: this.userManagerMock.Object,
                signInManager: this.signInManagerMock.Object,
                emailSender: Mock.Of<IEmailSender<User>>(),
                userService: Mock.Of<IUserService>(),
                linkGenerator: Mock.Of<LinkGenerator>(),
                accessControlService: this.accessControlServiceMock.Object,
                featureRolloutService: Mock.Of<IFeatureRolloutService>(),
                tokenSettings: this.tokenSettings,
                notificationService: Mock.Of<INotificationService>(),
                turnstileService: Mock.Of<ITurnstileService>(),
                turnstileSettings: Options.Create(new TurnstileSettings()),
                logger: Mock.Of<ILogger<AccessControlController>>());

            this.userManagerMock.Setup(x => x.GetRolesAsync(It.IsAny<User>())).ReturnsAsync([]);
            this.userManagerMock.Setup(x => x.GenerateUserTokenAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync("refresh-token");
            this.userManagerMock.Setup(x => x.SetAuthenticationTokenAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync(IdentityResult.Success);
        }

        [Fact]
        public async Task MobileSignInAsync_WhenUserNotFound_ReturnsUnauthorized()
        {
            this.userManagerMock.Setup(x => x.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync((User?)null);

            var result = await this.controller.MobileSignInAsync(new SignInRequestDTO
            {
                Email = "unknown@example.com",
                Password = "Passw0rd!"
            });

            result.ShouldBeOfType<UnauthorizedObjectResult>();
        }

        [Fact]
        public async Task MobileSignInAsync_WhenUserIsDisabled_ReturnsUnauthorized()
        {
            var disabledUser = new User(firstName: "Jane", lastName: "Doe", enabled: false);
            this.userManagerMock.Setup(x => x.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync(disabledUser);

            var result = await this.controller.MobileSignInAsync(new SignInRequestDTO
            {
                Email = "jane@example.com",
                Password = "Passw0rd!"
            });

            result.ShouldBeOfType<UnauthorizedObjectResult>();
        }

        [Fact]
        public async Task MobileSignInAsync_WhenPasswordIsInvalid_ReturnsUnauthorized()
        {
            this.SetContextWithCorrelationId();
            this.userManagerMock.Setup(x => x.FindByEmailAsync(this.user.Email!)).ReturnsAsync(this.user);
            this.signInManagerMock
                .Setup(x => x.CheckPasswordSignInAsync(this.user, "WrongPassword!", true))
                .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Failed);

            var result = await this.controller.MobileSignInAsync(new SignInRequestDTO
            {
                Email = this.user.Email!,
                Password = "WrongPassword!"
            });

            result.ShouldBeOfType<UnauthorizedObjectResult>();
        }

        [Fact]
        public async Task MobileSignInAsync_WhenCredentialsAreValid_ReturnsAccessAndRefreshTokens()
        {
            this.SetContextWithCorrelationId();
            this.userManagerMock.Setup(x => x.FindByEmailAsync(this.user.Email!)).ReturnsAsync(this.user);
            this.signInManagerMock
                .Setup(x => x.CheckPasswordSignInAsync(this.user, "Passw0rd!", true))
                .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);
            this.userManagerMock.Setup(x => x.GetTwoFactorEnabledAsync(this.user)).ReturnsAsync(false);

            var result = await this.controller.MobileSignInAsync(new SignInRequestDTO
            {
                Email = this.user.Email!,
                Password = "Passw0rd!"
            });

            var okResult = result.ShouldBeOfType<OkObjectResult>();
            var payload = okResult.Value.ShouldBeOfType<MobileLoginResponseDTO>();
            payload.AccessToken.ShouldNotBeNullOrEmpty();
            payload.RefreshToken.ShouldNotBeNullOrEmpty();
        }

        [Fact]
        public async Task MobileRefreshTokenAsync_WhenRequestIsNull_ReturnsUnauthorized()
        {
            var result = await this.controller.MobileRefreshTokenAsync(null!);

            result.ShouldBeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task MobileRefreshTokenAsync_WhenAccessTokenIsInvalid_ReturnsUnauthorized()
        {
            var result = await this.controller.MobileRefreshTokenAsync(new MobileRefreshRequestDTO
            {
                AccessToken = "not.a.valid.jwt",
                RefreshToken = "any-refresh-token"
            });

            result.ShouldBeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task MobileRefreshTokenAsync_WhenAccessTokenIsEmpty_ReturnsUnauthorized()
        {
            var result = await this.controller.MobileRefreshTokenAsync(new MobileRefreshRequestDTO
            {
                AccessToken = string.Empty,
                RefreshToken = "any-refresh-token"
            });

            result.ShouldBeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task MobileRefreshTokenAsync_WhenUserContextNotFound_ReturnsUnauthorized()
        {
            var accessToken = TokenUtil.GetToken(this.tokenSettings, this.user, new List<Claim>());
            this.accessControlServiceMock
                .Setup(x => x.GetRefreshTokenContextAsync(this.user.Id))
                .ReturnsAsync((RefreshTokenContextDTO?)null);

            var result = await this.controller.MobileRefreshTokenAsync(new MobileRefreshRequestDTO
            {
                AccessToken = accessToken,
                RefreshToken = "any-refresh-token"
            });

            result.ShouldBeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task MobileRefreshTokenAsync_WhenUserIsDisabled_ReturnsUnauthorized()
        {
            var accessToken = TokenUtil.GetToken(this.tokenSettings, this.user, new List<Claim>());
            var disabledUser = new User(firstName: "John", lastName: "Doe", enabled: false) { Id = this.user.Id };
            this.accessControlServiceMock
                .Setup(x => x.GetRefreshTokenContextAsync(this.user.Id))
                .ReturnsAsync(new RefreshTokenContextDTO(disabledUser, []));

            var result = await this.controller.MobileRefreshTokenAsync(new MobileRefreshRequestDTO
            {
                AccessToken = accessToken,
                RefreshToken = "any-refresh-token"
            });

            result.ShouldBeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task MobileRefreshTokenAsync_WhenRefreshTokenIsInvalid_ReturnsUnauthorized()
        {
            var accessToken = TokenUtil.GetToken(this.tokenSettings, this.user, new List<Claim>());
            this.accessControlServiceMock
                .Setup(x => x.GetRefreshTokenContextAsync(this.user.Id))
                .ReturnsAsync(new RefreshTokenContextDTO(this.user, []));
            this.userManagerMock
                .Setup(x => x.VerifyUserTokenAsync(this.user, It.IsAny<string>(), It.IsAny<string>(), "bad-refresh-token"))
                .ReturnsAsync(false);

            var result = await this.controller.MobileRefreshTokenAsync(new MobileRefreshRequestDTO
            {
                AccessToken = accessToken,
                RefreshToken = "bad-refresh-token"
            });

            result.ShouldBeOfType<UnauthorizedResult>();
        }

        [Fact]
        public async Task MobileRefreshTokenAsync_WhenAllValid_ReturnsNewAccessAndRefreshTokens()
        {
            var accessToken = TokenUtil.GetToken(this.tokenSettings, this.user, new List<Claim>());
            this.accessControlServiceMock
                .Setup(x => x.GetRefreshTokenContextAsync(this.user.Id))
                .ReturnsAsync(new RefreshTokenContextDTO(this.user, []));
            this.userManagerMock
                .Setup(x => x.VerifyUserTokenAsync(this.user, It.IsAny<string>(), It.IsAny<string>(), "valid-refresh-token"))
                .ReturnsAsync(true);

            var result = await this.controller.MobileRefreshTokenAsync(new MobileRefreshRequestDTO
            {
                AccessToken = accessToken,
                RefreshToken = "valid-refresh-token"
            });

            var okResult = result.ShouldBeOfType<OkObjectResult>();
            var payload = okResult.Value.ShouldBeOfType<MobileLoginResponseDTO>();
            payload.AccessToken.ShouldNotBeNullOrEmpty();
            payload.RefreshToken.ShouldNotBeNullOrEmpty();
        }

        [Fact]
        public async Task MobileSignInAsync_WhenMobileHeaderPresent_ShouldBypassCaptcha()
        {
            // Arrange
            this.user.AccessFailedCount = 3;

            var turnstileServiceMock = new Mock<ITurnstileService>();
            turnstileServiceMock.Setup(x => x.IsEnabled()).Returns(true);

            var controllerWithCaptcha = this.CreateControllerWithTurnstile(
                turnstileServiceMock.Object,
                this.tokenSettings);

            this.userManagerMock.Setup(x => x.FindByEmailAsync(this.user.Email!)).ReturnsAsync(this.user);
            this.signInManagerMock
                .Setup(x => x.CheckPasswordSignInAsync(this.user, "Passw0rd!", true))
                .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);
            this.userManagerMock.Setup(x => x.GetTwoFactorEnabledAsync(this.user)).ReturnsAsync(false);

            // Act
            var result = await controllerWithCaptcha.MobileSignInAsync(new SignInRequestDTO
            {
                Email = this.user.Email!,
                Password = "Passw0rd!"
            });

            // Assert — captcha was bypassed, login succeeds
            var okResult = result.ShouldBeOfType<OkObjectResult>();
            var payload = okResult.Value.ShouldBeOfType<MobileLoginResponseDTO>();
            payload.AccessToken.ShouldNotBeNullOrEmpty();
            payload.RefreshToken.ShouldNotBeNullOrEmpty();
        }

        private AccessControlController CreateControllerWithTurnstile(ITurnstileService turnstileService, TokenSettings tokenSettings)
        {
            var controllerWithCaptcha = new AccessControlController(
                userManager: this.userManagerMock.Object,
                signInManager: this.signInManagerMock.Object,
                emailSender: Mock.Of<IEmailSender<User>>(),
                userService: Mock.Of<IUserService>(),
                linkGenerator: Mock.Of<LinkGenerator>(),
                accessControlService: Mock.Of<IAccessControlService>(),
                featureRolloutService: Mock.Of<IFeatureRolloutService>(),
                tokenSettings: tokenSettings,
                notificationService: Mock.Of<INotificationService>(),
                turnstileService: turnstileService,
                turnstileSettings: Options.Create(new TurnstileSettings()),
                logger: Mock.Of<ILogger<AccessControlController>>());

            controllerWithCaptcha.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            };
            controllerWithCaptcha.ControllerContext.HttpContext.Request.Headers["X-Client-Type"] = "mobile";
            controllerWithCaptcha.ControllerContext.HttpContext.Items[correlationIdClaimType] = Guid.NewGuid().ToString();

            return controllerWithCaptcha;
        }

        private void SetContextWithCorrelationId()
        {
            this.controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            };
            this.controller.ControllerContext.HttpContext.Items[correlationIdClaimType] = Guid.NewGuid().ToString();
        }
    }
}
