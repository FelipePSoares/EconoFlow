using System.Security.Claims;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.Authentication;
using EasyFinance.Server.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using Moq;
using Shouldly;

namespace EasyFinance.Server.Tests.Controllers
{
    public class AccessControlControllerTwoFactorTests
    {
        private const string correlationIdClaimType = "CorrelationId";
        private readonly User user;
        private readonly Mock<UserManager<User>> userManagerMock;
        private readonly Mock<SignInManager<User>> signInManagerMock;
        private readonly AccessControlController controller;

        public AccessControlControllerTwoFactorTests()
        {
            this.user = new User(firstName: "John", lastName: "Doe", enabled: true)
            {
                Id = Guid.NewGuid(),
                UserName = "john.doe@example.com",
                Email = "john.doe@example.com",
                EmailConfirmed = true
            };

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

            this.signInManagerMock = new Mock<SignInManager<User>>(
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
                signInManager: this.signInManagerMock.Object,
                emailSender: Mock.Of<IEmailSender<User>>(),
                userService: Mock.Of<IUserService>(),
                linkGenerator: Mock.Of<LinkGenerator>(),
                accessControlService: Mock.Of<IAccessControlService>(),
                featureRolloutService: Mock.Of<IFeatureRolloutService>(),
                tokenSettings: new TokenSettings { SecretKey = Guid.NewGuid().ToString() },
                notificationService: Mock.Of<INotificationService>(),
                logger: Mock.Of<ILogger<AccessControlController>>());

            var urlHelperMock = new Mock<IUrlHelper>();
            urlHelperMock.Setup(x => x.Action(It.IsAny<UrlActionContext>())).Returns("/api/AccessControl/refresh-token");
            this.controller.Url = urlHelperMock.Object;

            this.userManagerMock.Setup(x => x.GetUserAsync(It.IsAny<ClaimsPrincipal>())).ReturnsAsync(this.user);
            this.userManagerMock.Setup(x => x.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync(this.user);
            this.userManagerMock.Setup(x => x.GetRolesAsync(It.IsAny<User>())).ReturnsAsync([]);
            this.userManagerMock.Setup(x => x.GenerateUserTokenAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync("refresh-token");
            this.userManagerMock.Setup(x => x.SetAuthenticationTokenAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync(IdentityResult.Success);
        }

        [Fact]
        public async Task GetTwoFactorSetupAsync_ShouldReturnSharedKeyOtpAuthUriAndCurrentStatus()
        {
            // Arrange
            var authenticatorKey = "JBSWY3DPEHPK3PXP";
            this.SetAuthenticatedContext();
            this.userManagerMock.Setup(x => x.GetAuthenticatorKeyAsync(this.user)).ReturnsAsync(authenticatorKey);
            this.userManagerMock.Setup(x => x.GetTwoFactorEnabledAsync(this.user)).ReturnsAsync(false);
            this.userManagerMock.Setup(x => x.GetEmailAsync(this.user)).ReturnsAsync(this.user.Email);

            // Act
            var result = await this.controller.GetTwoFactorSetupAsync();

            // Assert
            var okResult = result.ShouldBeOfType<OkObjectResult>();
            var payload = okResult.Value.ShouldBeOfType<TwoFactorSetupResponseDTO>();
            payload.IsTwoFactorEnabled.ShouldBeFalse();
            payload.SharedKey.ShouldBe("jbsw y3dp ehpk 3pxp");
            payload.OtpAuthUri.ShouldBe("otpauth://totp/EconoFlow:john.doe@example.com?secret=JBSWY3DPEHPK3PXP&issuer=EconoFlow&digits=6");
        }

        [Fact]
        public async Task EnableTwoFactorAsync_WithValidCode_ShouldEnableAndReturnRecoveryCodes()
        {
            // Arrange
            var recoveryCodes = new[] { "code-1", "code-2" };
            this.SetAuthenticatedContext();
            this.userManagerMock
                .Setup(x => x.VerifyTwoFactorTokenAsync(this.user, TokenOptions.DefaultAuthenticatorProvider, "123456"))
                .ReturnsAsync(true);
            this.userManagerMock.Setup(x => x.SetTwoFactorEnabledAsync(this.user, true)).ReturnsAsync(IdentityResult.Success);
            this.userManagerMock.Setup(x => x.GenerateNewTwoFactorRecoveryCodesAsync(this.user, 10)).ReturnsAsync(recoveryCodes);

            // Act
            var result = await this.controller.EnableTwoFactorAsync(new TwoFactorEnableRequestDTO
            {
                Code = "123-456"
            });

            // Assert
            var okResult = result.ShouldBeOfType<OkObjectResult>();
            var payload = okResult.Value.ShouldBeOfType<TwoFactorEnableResponseDTO>();
            payload.TwoFactorEnabled.ShouldBeTrue();
            payload.RecoveryCodes.ShouldBe(recoveryCodes);
        }

        [Fact]
        public async Task EnableTwoFactorAsync_WithInvalidCode_ShouldReturnBadRequest()
        {
            // Arrange
            this.SetAuthenticatedContext();
            this.userManagerMock
                .Setup(x => x.VerifyTwoFactorTokenAsync(this.user, TokenOptions.DefaultAuthenticatorProvider, "000000"))
                .ReturnsAsync(false);

            // Act
            var result = await this.controller.EnableTwoFactorAsync(new TwoFactorEnableRequestDTO
            {
                Code = "000000"
            });

            // Assert
            result.ShouldBeOfType<BadRequestObjectResult>();
            this.userManagerMock.Verify(x => x.SetTwoFactorEnabledAsync(It.IsAny<User>(), It.IsAny<bool>()), Times.Never);
        }

        [Fact]
        public async Task SignInAsync_WhenTwoFactorIsRequired_ShouldReturnMachineReadableRequiresTwoFactorResponse()
        {
            // Arrange
            this.SetContextWithCorrelationId();
            this.signInManagerMock
                .Setup(x => x.CheckPasswordSignInAsync(this.user, "Passw0rd!", true))
                .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.TwoFactorRequired);

            // Act
            var result = await this.controller.SignInAsync(new SignInRequestDTO
            {
                Email = this.user.Email!,
                Password = "Passw0rd!"
            });

            // Assert
            var unauthorizedResult = result.ShouldBeOfType<UnauthorizedObjectResult>();
            var payload = unauthorizedResult.Value.ShouldBeOfType<LoginFailureResponseDTO>();
            payload.Code.ShouldBe("TwoFactorRequired");
            payload.RequiresTwoFactor.ShouldBeTrue();
        }

        [Fact]
        public async Task SignInAsync_WhenTwoFactorCodeIsInvalid_ShouldReturnMachineReadableInvalidTwoFactorCodeResponse()
        {
            // Arrange
            this.SetContextWithCorrelationId();
            this.signInManagerMock
                .Setup(x => x.CheckPasswordSignInAsync(this.user, "Passw0rd!", true))
                .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.TwoFactorRequired);
            this.userManagerMock
                .Setup(x => x.VerifyTwoFactorTokenAsync(this.user, TokenOptions.DefaultAuthenticatorProvider, "123456"))
                .ReturnsAsync(false);

            // Act
            var result = await this.controller.SignInAsync(new SignInRequestDTO
            {
                Email = this.user.Email!,
                Password = "Passw0rd!",
                TwoFactorCode = "123456"
            });

            // Assert
            var unauthorizedResult = result.ShouldBeOfType<UnauthorizedObjectResult>();
            var payload = unauthorizedResult.Value.ShouldBeOfType<LoginFailureResponseDTO>();
            payload.Code.ShouldBe("InvalidTwoFactorCode");
            payload.RequiresTwoFactor.ShouldBeTrue();
            this.userManagerMock.Verify(x => x.GenerateUserTokenAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task SignInAsync_WhenPasswordIsValidAndUserHasTwoFactorEnabled_ShouldReturnRequiresTwoFactor()
        {
            // Arrange
            this.SetContextWithCorrelationId();
            this.signInManagerMock
                .Setup(x => x.CheckPasswordSignInAsync(this.user, "Passw0rd!", true))
                .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);
            this.userManagerMock.Setup(x => x.GetTwoFactorEnabledAsync(this.user)).ReturnsAsync(true);

            // Act
            var result = await this.controller.SignInAsync(new SignInRequestDTO
            {
                Email = this.user.Email!,
                Password = "Passw0rd!"
            });

            // Assert
            var unauthorizedResult = result.ShouldBeOfType<UnauthorizedObjectResult>();
            var payload = unauthorizedResult.Value.ShouldBeOfType<LoginFailureResponseDTO>();
            payload.Code.ShouldBe("TwoFactorRequired");
            payload.RequiresTwoFactor.ShouldBeTrue();
            this.userManagerMock.Verify(x => x.GenerateUserTokenAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task SignInAsync_WhenRecoveryCodeIsValid_ShouldSucceedAndIssueToken()
        {
            // Arrange
            this.SetContextWithCorrelationId();
            this.signInManagerMock
                .Setup(x => x.CheckPasswordSignInAsync(this.user, "Passw0rd!", true))
                .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.TwoFactorRequired);
            this.userManagerMock
                .Setup(x => x.RedeemTwoFactorRecoveryCodeAsync(this.user, "abcde-fghij"))
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await this.controller.SignInAsync(new SignInRequestDTO
            {
                Email = this.user.Email!,
                Password = "Passw0rd!",
                TwoFactorRecoveryCode = "abcde-fghij"
            });

            // Assert
            result.ShouldBeOfType<OkResult>();
            this.userManagerMock.Verify(x => x.GenerateUserTokenAsync(this.user, It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task RegenerateTwoFactorRecoveryCodesAsync_WithValidCredentialsAndAuthenticatorCode_ShouldReturnNewCodes()
        {
            // Arrange
            var recoveryCodes = new[] { "new-code-1", "new-code-2" };
            this.SetAuthenticatedContext();
            this.userManagerMock.Setup(x => x.GetTwoFactorEnabledAsync(this.user)).ReturnsAsync(true);
            this.userManagerMock.Setup(x => x.CheckPasswordAsync(this.user, "Passw0rd!")).ReturnsAsync(true);
            this.userManagerMock
                .Setup(x => x.VerifyTwoFactorTokenAsync(this.user, TokenOptions.DefaultAuthenticatorProvider, "654321"))
                .ReturnsAsync(true);
            this.userManagerMock.Setup(x => x.GenerateNewTwoFactorRecoveryCodesAsync(this.user, 10)).ReturnsAsync(recoveryCodes);

            // Act
            var result = await this.controller.RegenerateTwoFactorRecoveryCodesAsync(new TwoFactorSecureActionRequestDTO
            {
                Password = "Passw0rd!",
                TwoFactorCode = "654321"
            });

            // Assert
            var okResult = result.ShouldBeOfType<OkObjectResult>();
            var payload = okResult.Value.ShouldBeOfType<TwoFactorRecoveryCodesResponseDTO>();
            payload.RecoveryCodes.ShouldBe(recoveryCodes);
        }

        [Fact]
        public async Task DisableTwoFactorAsync_WithValidCredentialsAndAuthenticatorCode_ShouldDisableTwoFactor()
        {
            // Arrange
            this.SetAuthenticatedContext();
            this.userManagerMock.Setup(x => x.GetTwoFactorEnabledAsync(this.user)).ReturnsAsync(true);
            this.userManagerMock.Setup(x => x.CheckPasswordAsync(this.user, "Passw0rd!")).ReturnsAsync(true);
            this.userManagerMock
                .Setup(x => x.VerifyTwoFactorTokenAsync(this.user, TokenOptions.DefaultAuthenticatorProvider, "654321"))
                .ReturnsAsync(true);
            this.userManagerMock.Setup(x => x.SetTwoFactorEnabledAsync(this.user, false)).ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await this.controller.DisableTwoFactorAsync(new TwoFactorSecureActionRequestDTO
            {
                Password = "Passw0rd!",
                TwoFactorCode = "654321"
            });

            // Assert
            var okResult = result.ShouldBeOfType<OkObjectResult>();
            var payload = okResult.Value.ShouldBeOfType<TwoFactorStatusResponseDTO>();
            payload.TwoFactorEnabled.ShouldBeFalse();
            this.userManagerMock.Verify(x => x.SetTwoFactorEnabledAsync(this.user, false), Times.Once);
        }

        private void SetAuthenticatedContext()
        {
            var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, this.user.Id.ToString())], "TestAuthType");
            this.controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(identity)
                }
            };
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
