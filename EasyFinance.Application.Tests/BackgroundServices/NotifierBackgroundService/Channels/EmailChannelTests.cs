using System.Globalization;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Application.Features.EmailService;
using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Logging;
using Moq;
using Newtonsoft.Json;

namespace EasyFinance.Application.Tests.BackgroundServices.NotifierBackgroundService.Channels
{
    public class EmailChannelTests : BaseTests
    {
        private Mock<IEmailService> mockEmailService;
        private Mock<ILogger<EmailChannel>> mockLogger;
        private EmailChannel emailChannel;

        public EmailChannelTests()
        {
            this.mockEmailService = new Mock<IEmailService>();
            this.mockLogger = new Mock<ILogger<EmailChannel>>();

            this.emailChannel = new EmailChannel(this.mockEmailService.Object, this.mockLogger.Object);
        }

        [Fact]
        public async Task SendAsync_SendWelcomeMessage_ShouldReturnSucceeded()
        {
            // Arrange
            this.mockEmailService
                .Setup(es => es.SendEmailAsync(
                    It.IsAny<string>(),
                    It.IsAny<DTOs.BackgroundService.Email.EmailTemplates>(),
                    It.IsAny<CultureInfo>(),
                    It.IsAny<(string token, string replaceWith)[]>()))
                .ReturnsAsync(AppResponse.Success());

            var user = new UserBuilder().Build();

            var notification = new Notification(user, "WelcomeMessage", NotificationType.Information, NotificationCategory.System);

            // Act
            var result = await this.emailChannel.SendAsync(notification);

            // Assert
            Assert.True(result.Succeeded);
        }

        [Fact]
        public async Task SendAsync_TrySendInexistentTemplate_ShouldReturnFailed()
        {
            // Arrange
            this.mockEmailService
                .Setup(es => es.SendEmailAsync(
                    It.IsAny<string>(),
                    It.IsAny<DTOs.BackgroundService.Email.EmailTemplates>(),
                    It.IsAny<CultureInfo>(),
                    It.IsAny<(string token, string replaceWith)[]>()))
                .ReturnsAsync(AppResponse.Success());

            var user = new UserBuilder().Build();

            var notification = new Notification(user, "InexistentTemplate", NotificationType.Information, NotificationCategory.System);

            // Act
            var result = await this.emailChannel.SendAsync(notification);

            // Assert
            Assert.True(result.Failed);
            result.Messages.ToList().ForEach(m => Assert.Equal("Email template not found", m.Description));
        }

        [Fact]
        public async Task SendAsync_SendTemplateWithParameter_ShouldReturnSucceededWithParametersReplaced()
        {
            // Arrange
            this.mockEmailService
                .Setup(es => es.SendEmailAsync(
                    It.IsAny<string>(),
                    It.IsAny<DTOs.BackgroundService.Email.EmailTemplates>(),
                    It.IsAny<CultureInfo>(),
                    It.IsAny<(string token, string replaceWith)[]>()))
                .ReturnsAsync(AppResponse.Success());

            var user = new UserBuilder().Build();

            var metadata = new
            {
                callbackUrl = "https://easyfinance.com/reset-password?token=abcd1234"
            };

            var notification = new Notification(user, "ResetPassword", NotificationType.Information, NotificationCategory.System, metadata: JsonConvert.SerializeObject(metadata));

            // Act
            var result = await this.emailChannel.SendAsync(notification);

            // Assert
            Assert.True(result.Succeeded);
            this.mockEmailService.Verify(es => es.SendEmailAsync(
                user.Email,
                DTOs.BackgroundService.Email.EmailTemplates.ResetPassword,
                It.IsAny<CultureInfo>(),
                It.Is<(string token, string replaceWith)[]>(tokens => tokens.Any(t => t.token == "{{callbackUrl}}" && t.replaceWith == metadata.callbackUrl))
            ), Times.Once);
        }
    }
}
