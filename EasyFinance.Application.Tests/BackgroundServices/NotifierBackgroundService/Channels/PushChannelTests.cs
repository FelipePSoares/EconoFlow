using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Application.Features.ExpoPushTokenService;
using EasyFinance.Application.Features.NotificationMessageResolver;
using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace EasyFinance.Application.Tests.BackgroundServices.NotifierBackgroundService.Channels
{
    public class PushChannelTests : BaseTests
    {
        private readonly Mock<IExpoPushTokenService> tokenServiceMock = new();
        private readonly Mock<IExpoPushClient> pushClientMock = new();
        private readonly Mock<INotificationMessageResolver> messageResolverMock = new();
        private readonly Mock<ILogger<PushChannel>> loggerMock = new();

        private PushChannel CreateChannel() =>
            new PushChannel(tokenServiceMock.Object, pushClientMock.Object, messageResolverMock.Object, loggerMock.Object);

        [Fact]
        public async Task SendAsync_UserHasActiveToken_ShouldCallPushClient()
        {
            var notification = new NotificationBuilder().Build();
            var token = "ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]";

            tokenServiceMock
                .Setup(s => s.GetActiveTokensForUserAsync(notification.User.Id))
                .ReturnsAsync([token]);

            pushClientMock
                .Setup(c => c.SendAsync(It.IsAny<IEnumerable<ExpoMessage>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(AppResponse.Success());

            var result = await CreateChannel().SendAsync(notification);

            result.Succeeded.Should().BeTrue();
            pushClientMock.Verify(
                c => c.SendAsync(
                    It.Is<IEnumerable<ExpoMessage>>(msgs => msgs.Any(m => m.To == token)),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task SendAsync_UserHasNoActiveTokens_ShouldReturnSuccessWithoutCallingClient()
        {
            var notification = new NotificationBuilder().Build();

            tokenServiceMock
                .Setup(s => s.GetActiveTokensForUserAsync(notification.User.Id))
                .ReturnsAsync([]);

            var result = await CreateChannel().SendAsync(notification);

            result.Succeeded.Should().BeTrue();
            pushClientMock.Verify(
                c => c.SendAsync(It.IsAny<IEnumerable<ExpoMessage>>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task SendAsync_ClientReturnsFailure_ShouldReturnFailure()
        {
            var notification = new NotificationBuilder().Build();
            var token = "ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]";

            tokenServiceMock
                .Setup(s => s.GetActiveTokensForUserAsync(notification.User.Id))
                .ReturnsAsync([token]);

            pushClientMock
                .Setup(c => c.SendAsync(It.IsAny<IEnumerable<ExpoMessage>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(AppResponse.Error("push-failed", "Delivery failed"));

            var result = await CreateChannel().SendAsync(notification);

            result.Failed.Should().BeTrue();
        }

        [Fact]
        public async Task SendAsync_KnownCodeMessage_ShouldSendResolvedBody()
        {
            var notification = new NotificationBuilder().AddCodeMessage("BUDGET_WARNING").Build();
            var token = "ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]";

            tokenServiceMock
                .Setup(s => s.GetActiveTokensForUserAsync(notification.User.Id))
                .ReturnsAsync([token]);

            messageResolverMock
                .Setup(r => r.ResolveBody(notification))
                .Returns("Warning: Budget for 'Groceries' in project 'Monthly' is nearly exhausted (80%).");

            IEnumerable<ExpoMessage>? capturedMessages = null;
            pushClientMock
                .Setup(c => c.SendAsync(It.IsAny<IEnumerable<ExpoMessage>>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<ExpoMessage>, CancellationToken>((msgs, _) => capturedMessages = msgs.ToList())
                .ReturnsAsync(AppResponse.Success());

            await CreateChannel().SendAsync(notification);

            capturedMessages.Should().NotBeNull();
            var message = capturedMessages!.Single();
            message.Title.Should().Be("EconoFlow");
            message.Body.Should().Be("Warning: Budget for 'Groceries' in project 'Monthly' is nearly exhausted (80%).");
            message.Body.Should().NotBe("BUDGET_WARNING");
        }

        [Fact]
        public async Task SendAsync_InvalidToken_ShouldRevokeTokenAndSucceed()
        {
            var notification = new NotificationBuilder().Build();
            var invalidToken = "ExponentPushToken[INVALID]";

            tokenServiceMock
                .Setup(s => s.GetActiveTokensForUserAsync(notification.User.Id))
                .ReturnsAsync([invalidToken]);

            pushClientMock
                .Setup(c => c.SendAsync(It.IsAny<IEnumerable<ExpoMessage>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(AppResponse.Error("DeviceNotRegistered", "Token invalid"));

            var result = await CreateChannel().SendAsync(notification);

            tokenServiceMock.Verify(
                s => s.RevokeTokenAsync(notification.User.Id, invalidToken),
                Times.Once);
        }
    }
}
