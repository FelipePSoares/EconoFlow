using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.Authentication;
using EasyFinance.Infrastructure.DTOs;
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
    public class AccessControlControllerUnsubscribeTests
    {
        private readonly Mock<IUserService> userServiceMock;
        private readonly Mock<UserManager<User>> userManagerMock;
        private readonly AccessControlController controller;

        public AccessControlControllerUnsubscribeTests()
        {
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

            this.userServiceMock = new Mock<IUserService>();

            this.controller = new AccessControlController(
                userManager: this.userManagerMock.Object,
                signInManager: signInManagerMock.Object,
                emailSender: Mock.Of<IEmailSender<User>>(),
                userService: this.userServiceMock.Object,
                linkGenerator: Mock.Of<LinkGenerator>(),
                accessControlService: Mock.Of<IAccessControlService>(),
                tokenSettings: new TokenSettings { SecretKey = Guid.NewGuid().ToString() },
                notificationService: Mock.Of<INotificationService>(),
                logger: Mock.Of<ILogger<AccessControlController>>());
        }

        [Fact]
        public async Task UnsubscribeFromEmailNotificationsAsync_EmptySignature_ShouldReturnBadRequest()
        {
            // Arrange
            var userId = Guid.NewGuid();

            // Act
            var result = await this.controller.UnsubscribeFromEmailNotificationsAsync(userId, string.Empty);

            // Assert
            result.ShouldBeOfType<BadRequestObjectResult>();
            this.userServiceMock.Verify(service => service.UnsubscribeFromEmailNotificationsAsync(It.IsAny<Guid>()), Times.Never);
        }

        [Fact]
        public async Task UnsubscribeFromEmailNotificationsAsync_InvalidSignature_ShouldReturnBadRequest()
        {
            // Arrange
            var userId = Guid.NewGuid();
            this.userServiceMock
                .Setup(service => service.ValidateUnsubscribeSignature(userId, "invalid-signature"))
                .Returns(false);

            // Act
            var result = await this.controller.UnsubscribeFromEmailNotificationsAsync(userId, "invalid-signature");

            // Assert
            result.ShouldBeOfType<BadRequestObjectResult>();
            this.userServiceMock.Verify(service => service.UnsubscribeFromEmailNotificationsAsync(It.IsAny<Guid>()), Times.Never);
        }

        [Fact]
        public async Task UnsubscribeFromEmailNotificationsAsync_ValidSignature_ShouldReturnContentResult()
        {
            // Arrange
            var userId = Guid.NewGuid();
            this.userServiceMock
                .Setup(service => service.ValidateUnsubscribeSignature(userId, "valid-signature"))
                .Returns(true);
            this.userServiceMock
                .Setup(service => service.UnsubscribeFromEmailNotificationsAsync(userId))
                .ReturnsAsync(AppResponse.Success());

            // Act
            var result = await this.controller.UnsubscribeFromEmailNotificationsAsync(userId, "valid-signature");

            // Assert
            var contentResult = result.ShouldBeOfType<ContentResult>();
            contentResult.Content.ShouldBe("You have been unsubscribed from email notifications.");
            this.userServiceMock.Verify(service => service.UnsubscribeFromEmailNotificationsAsync(userId), Times.Once);
        }
    }
}
