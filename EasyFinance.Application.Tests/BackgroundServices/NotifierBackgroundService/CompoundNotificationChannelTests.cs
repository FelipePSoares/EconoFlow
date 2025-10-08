using EasyFinance.Application.BackgroundServices.NotifierBackgroundService;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Logging;
using Moq;

namespace EasyFinance.Application.Tests.BackgroundServices.NotifierBackgroundService
{
    public class CompoundNotificationChannelTests : BaseTests
    {
        private CompoundNotificationChannel compoundNotificationChannel;

        public CompoundNotificationChannelTests()
        {
            var mockLogger = new Mock<ILogger<CompoundNotificationChannel>>();

            this.compoundNotificationChannel = new CompoundNotificationChannel(mockLogger.Object);
        }

        [Fact]
        public async Task SendAsync_NoChannelsConfigured_ReturnsSuccess()
        {
            // Arrange
            var notification = new Domain.Account.Notification(
                user: new UserBuilder().Build(),
                codeMessage: "TestMessage",
                type: Domain.Account.NotificationType.Information,
                category: Domain.Account.NotificationCategory.System
            );

            // Act
            var result = await compoundNotificationChannel.SendAsync(notification);

            // Assert
            Assert.True(result.Succeeded);
        }

        [Fact]
        public async Task SendAsync_AllChannelsSucceed_ReturnsSuccess()
        {
            // Arrange
            var mockChannel1 = new Mock<INotificationChannel>();
            mockChannel1.Setup(c => c.SendAsync(It.IsAny<Domain.Account.Notification>()))
                .ReturnsAsync(AppResponse.Success());

            var mockChannel2 = new Mock<INotificationChannel>();
            mockChannel2.Setup(c => c.SendAsync(It.IsAny<Domain.Account.Notification>()))
                .ReturnsAsync(AppResponse.Success());

            compoundNotificationChannel.AddChannel(mockChannel1.Object);
            compoundNotificationChannel.AddChannel(mockChannel2.Object);

            var notification = new Domain.Account.Notification(
                user: new UserBuilder().Build(),
                codeMessage: "TestMessage",
                type: Domain.Account.NotificationType.Information,
                category: Domain.Account.NotificationCategory.System
            );

            // Act
            var result = await compoundNotificationChannel.SendAsync(notification);

            // Assert
            Assert.True(result.Succeeded);
        }

        [Fact]
        public async Task SendAsync_SomeChannelsFail_ReturnsSuccessWithWarnings()
        {
            // Arrange
            var mockChannel1 = new Mock<INotificationChannel>();
            mockChannel1.Setup(c => c.SendAsync(It.IsAny<Domain.Account.Notification>()))
                .ReturnsAsync(AppResponse.Success());

            var mockChannel2 = new Mock<INotificationChannel>();
            mockChannel2.Setup(c => c.SendAsync(It.IsAny<Domain.Account.Notification>()))
                .ReturnsAsync(AppResponse.Error("Channel failed"));

            compoundNotificationChannel.AddChannel(mockChannel1.Object);
            compoundNotificationChannel.AddChannel(mockChannel2.Object);

            var notification = new Domain.Account.Notification(
                user: new UserBuilder().Build(),
                codeMessage: "TestMessage",
                type: Domain.Account.NotificationType.Information,
                category: Domain.Account.NotificationCategory.System
            );

            // Act
            var result = await compoundNotificationChannel.SendAsync(notification);

            // Assert
            Assert.True(result.Succeeded);
        }

        [Fact]
        public async Task SendAsync_AllChannelsFail_ReturnsError()
        {
            // Arrange
            var mockChannel1 = new Mock<INotificationChannel>();
            mockChannel1.Setup(c => c.SendAsync(It.IsAny<Domain.Account.Notification>()))
                .ReturnsAsync(AppResponse.Error("Channel 1 failed"));

            var mockChannel2 = new Mock<INotificationChannel>();
            mockChannel2.Setup(c => c.SendAsync(It.IsAny<Domain.Account.Notification>()))
                .ReturnsAsync(AppResponse.Error("Channel 2 failed"));

            compoundNotificationChannel.AddChannel(mockChannel1.Object);
            compoundNotificationChannel.AddChannel(mockChannel2.Object);

            var notification = new Domain.Account.Notification(
                user: new UserBuilder().Build(),
                codeMessage: "TestMessage",
                type: Domain.Account.NotificationType.Information,
                category: Domain.Account.NotificationCategory.System
            );

            // Act
            var result = await compoundNotificationChannel.SendAsync(notification);

            // Assert
            Assert.True(result.Failed);
        }
    }
}
