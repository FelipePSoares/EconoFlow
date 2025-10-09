using EasyFinance.Application.BackgroundServices.NotifierBackgroundService;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Application.Features.EmailService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.Account;
using Microsoft.Extensions.Logging;
using Moq;

namespace EasyFinance.Application.Tests.BackgroundServices.NotifierBackgroundService
{
    public class NotificationChannelFactoryTests : BaseTests
    {
        private Mock<EmailChannel> emailChannelMock;
        private Mock<SmsChannel> smsChannelMock;
        private Mock<PushChannel> pushChannelMock;
        private Mock<IServiceProvider> serviceProviderMock;
        private CompoundNotificationChannel CompoundNotificationChannel;
        private NotificationChannelFactory notificationChannelFactory;

        public NotificationChannelFactoryTests()
        {
            this.emailChannelMock = new Mock<EmailChannel>(new Mock<IEmailService>().Object, new Mock<ILogger<EmailChannel>>().Object);
            this.smsChannelMock = new Mock<SmsChannel>(new Mock<ILogger<SmsChannel>>().Object);
            this.pushChannelMock = new Mock<PushChannel>(new Mock<ILogger<PushChannel>>().Object);
            this.serviceProviderMock = new Mock<IServiceProvider>();
            this.CompoundNotificationChannel = new CompoundNotificationChannel(new Mock<ILogger<CompoundNotificationChannel>>().Object);

            this.notificationChannelFactory = new NotificationChannelFactory(serviceProviderMock.Object);
        }

        [Fact]
        public void Create_NoChannels_ReturnsCompoundChannelWithNoChannels()
        {
            // Arrange
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(CompoundNotificationChannel))).Returns(this.CompoundNotificationChannel);

            // Act
            var result = this.notificationChannelFactory.Create(NotificationChannels.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(this.CompoundNotificationChannel, result);
        }

        [Fact]
        public void Create_MultipleChannels_ReturnsCompoundChannelWithAllChannels()
        {
            // Arrange
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(CompoundNotificationChannel))).Returns(this.CompoundNotificationChannel);
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(EmailChannel))).Returns(emailChannelMock.Object);
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(SmsChannel))).Returns(smsChannelMock.Object);
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(PushChannel))).Returns(pushChannelMock.Object);
            var channelsToTest = NotificationChannels.Email | NotificationChannels.Sms | NotificationChannels.Push;

            // Act
            var result = this.notificationChannelFactory.Create(channelsToTest);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(this.CompoundNotificationChannel, result);

            // Verify that the channels were added to the compound channel
            var compoundChannelField = typeof(CompoundNotificationChannel).GetField("channels", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            var channelsList = compoundChannelField.GetValue(this.CompoundNotificationChannel) as List<INotificationChannel>;
            Assert.Contains(emailChannelMock.Object, channelsList);
            Assert.Contains(smsChannelMock.Object, channelsList);
            Assert.Contains(pushChannelMock.Object, channelsList);
        }

        [Fact]
        public void Create_SingleChannel_ReturnsCompoundChannelWithSingleChannel()
        {
            // Arrange
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(CompoundNotificationChannel))).Returns(this.CompoundNotificationChannel);
            this.serviceProviderMock.Setup(sp => sp.GetService(typeof(EmailChannel))).Returns(emailChannelMock.Object);
            var channelsToTest = NotificationChannels.Email;

            // Act
            var result = this.notificationChannelFactory.Create(channelsToTest);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(this.CompoundNotificationChannel, result);
            // Verify that the channel was added to the compound channel
            var compoundChannelField = typeof(CompoundNotificationChannel).GetField("channels", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            var channelsList = compoundChannelField.GetValue(this.CompoundNotificationChannel) as List<INotificationChannel>;
            Assert.Contains(emailChannelMock.Object, channelsList);
            Assert.DoesNotContain(smsChannelMock.Object, channelsList);
            Assert.DoesNotContain(pushChannelMock.Object, channelsList);
        }
    }
}
