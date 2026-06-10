using System.Globalization;
using System.Threading;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Application.Features.TurnstileService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.Authentication;
using EasyFinance.Server.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Shouldly;

#pragma warning disable CS8602 // Dereference of a possibly null reference.
namespace EasyFinance.Server.Tests.Controllers
{
    public class AccessControlControllerRegisterTests
    {
        private readonly Mock<IUserStore<User>> _userStoreMock;
        private readonly Mock<UserManager<User>> _userManagerMock;
        private readonly AccessControlController _controller;

        public AccessControlControllerRegisterTests()
        {
            _userStoreMock = new Mock<IUserStore<User>>();
            // Extend the mock to implement IUserEmailStore<User> BEFORE Object is first
            // accessed (Moq requires As<T>() to be called before the first Object access).
            _userStoreMock.As<IUserEmailStore<User>>();

#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            _userManagerMock = new Mock<UserManager<User>>(
                _userStoreMock.Object,
                null, null, null, null, null, null, null, null);

            var signInManagerMock = new Mock<SignInManager<User>>(
                _userManagerMock.Object,
                Mock.Of<IHttpContextAccessor>(),
                Mock.Of<IUserClaimsPrincipalFactory<User>>(),
                null, null, null, null);
#pragma warning restore CS8625 // Cannot convert null literal to non-nullable reference type.

            _controller = new AccessControlController(
                userManager: _userManagerMock.Object,
                signInManager: signInManagerMock.Object,
                emailSender: Mock.Of<IEmailSender<User>>(),
                userService: Mock.Of<IUserService>(),
                linkGenerator: Mock.Of<LinkGenerator>(),
                accessControlService: Mock.Of<IAccessControlService>(),
                featureRolloutService: Mock.Of<IFeatureRolloutService>(),
                tokenSettings: new TokenSettings { SecretKey = Guid.NewGuid().ToString() },
                notificationService: Mock.Of<INotificationService>(),
                turnstileService: Mock.Of<ITurnstileService>(),
                turnstileSettings: Options.Create(new TurnstileSettings()),
                logger: Mock.Of<ILogger<AccessControlController>>());
        }

        [Theory]
        [InlineData("en-US", "en")]
        [InlineData("pt-BR", "pt")]
        [InlineData("en-GB", "en")]
        [InlineData("pt", "pt")]
        [InlineData("en", "en")]
        public async Task Register_NormalizesLanguageCodeToTwoLetterISOCode(string uiCulture, string expectedCode)
        {
            // Arrange
            var originalCulture = CultureInfo.CurrentUICulture;
            try
            {
            CultureInfo.CurrentUICulture = new CultureInfo(uiCulture);

            User? capturedUser = null;
            _userManagerMock.Setup(u => u.SupportsUserEmail).Returns(true);
            _userManagerMock
                .Setup(u => u.CreateAsync(It.IsAny<User>(), It.IsAny<string>()))
                .Callback<User, string>((user, _) => capturedUser = user)
                .ReturnsAsync(IdentityResult.Success);
            _userManagerMock
                .Setup(u => u.GenerateEmailConfirmationTokenAsync(It.IsAny<User>()))
                .ReturnsAsync("token");

            _userStoreMock.As<IUserEmailStore<User>>()
                .Setup(s => s.SetUserNameAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _userStoreMock.As<IUserEmailStore<User>>()
                .Setup(s => s.SetEmailAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            };

            var registration = new RegisterRequestDTO { Email = "test@example.com", Password = "Password1!" };

            // Act — NotSupportedException from link generation is expected in unit tests
            // that don't set up the full routing infrastructure; language code is already
            // captured via the CreateAsync callback before that path is reached.
            try { await _controller.Register(_userStoreMock.Object, registration); }
            catch (NotSupportedException) { }

            // Assert
            capturedUser.ShouldNotBeNull();
            capturedUser!.LanguageCode.ShouldBe(expectedCode);
            }
            finally
            {
                CultureInfo.CurrentUICulture = originalCulture;
            }
        }
    }
}
#pragma warning restore CS8602 // Dereference of a possibly null reference.
