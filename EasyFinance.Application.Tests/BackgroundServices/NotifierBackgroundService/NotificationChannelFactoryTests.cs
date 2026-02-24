using EasyFinance.Application.BackgroundServices.NotifierBackgroundService;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Application.Features.EmailService;
using EasyFinance.Application.Features.WebPushService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.Account;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace EasyFinance.Application.Tests.BackgroundServices.NotifierBackgroundService
{
    public class NotificationChannelFactoryTests : BaseTests
    {
        private readonly Mock<EmailChannel> emailChannelMock;
        private readonly Mock<SmsChannel> smsChannelMock;
        private readonly Mock<PushChannel> pushChannelMock;
        private readonly Mock<WebPushChannel> webPushChannelMock;
        private readonly Mock<IServiceProvider> serviceProviderMock;
        private readonly CompoundNotificationChannel compoundNotificationChannel;
        private readonly NotificationChannelFactory notificationChannelFactory;

        public NotificationChannelFactoryTests()
        {
            this.emailChannelMock = new Mock<EmailChannel>(new Mock<IEmailService>().Object, new Mock<ILogger<EmailChannel>>().Object);
            this.smsChannelMock = new Mock<SmsChannel>(new Mock<ILogger<SmsChannel>>().Object);
            this.pushChannelMock = new Mock<PushChannel>(new Mock<ILogger<PushChannel>>().Object);
            this.webPushChannelMock = new Mock<WebPushChannel>(new Mock<IWebPushService>().Object, new Mock<ILogger<WebPushChannel>>().Object);
            this.serviceProviderMock = new Mock<IServiceProvider>();
            this.compoundNotificationChannel = new CompoundNotificationChannel(new Mock<ILogger<CompoundNotificationChannel>>().Object);

            this.notificationChannelFactory = new NotificationChannelFactory(serviceProviderMock.Object);
        }

        [Fact]
        public void Create_NoChannels_ReturnsCompoundChannelWithNoChannels()
        {
            // Arrange
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(CompoundNotificationChannel))).Returns(this.compoundNotificationChannel);

            // Act
            var result = this.notificationChannelFactory.Create(NotificationChannels.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(this.compoundNotificationChannel, result);
        }

        [Fact]
        public void Create_MultipleChannels_WhenAppPushIsNotConfigured_ShouldUseWebPushFallback()
        {
            // Arrange
            SetupCommonChannelServices();
            SetupWebPushOptions(appPushConfigured: false);
            var channelsToTest = NotificationChannels.Email | NotificationChannels.Sms | NotificationChannels.Push;

            // Act
            var result = this.notificationChannelFactory.Create(channelsToTest);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(this.compoundNotificationChannel, result);

            var channelsList = GetConfiguredChannels();
            Assert.Contains(emailChannelMock.Object, channelsList);
            Assert.Contains(smsChannelMock.Object, channelsList);
            Assert.Contains(webPushChannelMock.Object, channelsList);
            Assert.DoesNotContain(pushChannelMock.Object, channelsList);
        }

        [Fact]
        public void Create_WhenAppPushIsConfigured_ShouldKeepPushChannel()
        {
            // Arrange
            SetupCommonChannelServices();
            SetupWebPushOptions(appPushConfigured: true);

            // Act
            var result = this.notificationChannelFactory.Create(NotificationChannels.Push);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(this.compoundNotificationChannel, result);

            var channelsList = GetConfiguredChannels();
            Assert.Contains(pushChannelMock.Object, channelsList);
            Assert.DoesNotContain(webPushChannelMock.Object, channelsList);
        }

        [Fact]
        public void Create_SingleChannel_ReturnsCompoundChannelWithSingleChannel()
        {
            // Arrange
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(CompoundNotificationChannel))).Returns(this.compoundNotificationChannel);
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(EmailChannel))).Returns(emailChannelMock.Object);
            var channelsToTest = NotificationChannels.Email;

            // Act
            var result = this.notificationChannelFactory.Create(channelsToTest);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(this.compoundNotificationChannel, result);

            var channelsList = GetConfiguredChannels();
            Assert.Contains(emailChannelMock.Object, channelsList);
            Assert.DoesNotContain(smsChannelMock.Object, channelsList);
            Assert.DoesNotContain(pushChannelMock.Object, channelsList);
            Assert.DoesNotContain(webPushChannelMock.Object, channelsList);
        }

        private void SetupCommonChannelServices()
        {
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(CompoundNotificationChannel))).Returns(this.compoundNotificationChannel);
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(EmailChannel))).Returns(emailChannelMock.Object);
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(SmsChannel))).Returns(smsChannelMock.Object);
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(PushChannel))).Returns(pushChannelMock.Object);
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(WebPushChannel))).Returns(webPushChannelMock.Object);
        }

        private void SetupWebPushOptions(bool appPushConfigured)
        {
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(IOptions<WebPushOptions>)))
                .Returns(Options.Create(new WebPushOptions
                {
                    AppPushConfigured = appPushConfigured
                }));
        }

        private List<INotificationChannel> GetConfiguredChannels()
        {
            var compoundChannelField = typeof(CompoundNotificationChannel)
                .GetField("channels", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            return compoundChannelField!.GetValue(this.compoundNotificationChannel) as List<INotificationChannel> ?? [];
        }
    }
}
