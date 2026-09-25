using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.Features.EmailService;
using FluentAssertions;
using MailKit.Security;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MimeKit;
using Moq;

namespace EasyFinance.Application.Tests.Features.EmailService
{
    public class SmtpEmailSenderTests
    {
        private readonly Mock<ISmtpClient> clientMock = new();
        private readonly Mock<ISmtpClientFactory> clientFactoryMock = new();
        private readonly SmtpSettings settings = new()
        {
            Host = "smtp.econoflow.pt",
            Port = 2525,
            Username = "smtp-user",
            Password = "smtp-password",
            SecureSocket = "StartTls",
            FromAddress = "noreply@econoflow.pt",
            FromName = "NoReply EconoFlow",
            TimeoutSeconds = 30,
        };

        public SmtpEmailSenderTests()
        {
            this.clientFactoryMock.Setup(factory => factory.Create()).Returns(this.clientMock.Object);
        }

        [Fact]
        public async Task SendAsync_ShouldConnectUsingConfiguredHostPortAndSecureSocket()
        {
            await CreateSender().SendAsync(SampleEmail());

            this.clientMock.Verify(client => client.ConnectAsync(
                "smtp.econoflow.pt",
                2525,
                SecureSocketOptions.StartTls,
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SendAsync_ShouldAuthenticateWithConfiguredCredentials()
        {
            await CreateSender().SendAsync(SampleEmail());

            this.clientMock.Verify(client => client.AuthenticateAsync(
                "smtp-user",
                "smtp-password",
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SendAsync_ShouldSendHtmlMessageWithConfiguredFromAndRecipient()
        {
            var email = SampleEmail();
            MimeMessage? sentMessage = null;
            this.clientMock
                .Setup(client => client.SendAsync(It.IsAny<MimeMessage>(), It.IsAny<CancellationToken>()))
                .Callback<MimeMessage, CancellationToken>((message, _) => sentMessage = message)
                .Returns(Task.CompletedTask);

            await CreateSender().SendAsync(email);

            sentMessage.Should().NotBeNull();
            var from = sentMessage!.From.Mailboxes.Should().ContainSingle().Subject;
            from.Name.Should().Be("NoReply EconoFlow");
            from.Address.Should().Be("noreply@econoflow.pt");
            sentMessage.To.Mailboxes.Select(mailbox => mailbox.Address)
                .Should().Equal("user@example.com");
            sentMessage.Subject.Should().Be("Welcome to EconoFlow");

            var body = sentMessage.Body.Should().BeOfType<TextPart>().Subject;
            body.ContentType.MimeType.Should().Be("text/html");
            body.ContentType.Charset.Should().BeEquivalentTo("utf-8");
            body.Text.Should().Be(email.BodyHtml);
        }

        [Fact]
        public async Task SendAsync_WithMultipleRecipients_ShouldAddEveryRecipient()
        {
            MimeMessage? sentMessage = null;
            this.clientMock
                .Setup(client => client.SendAsync(It.IsAny<MimeMessage>(), It.IsAny<CancellationToken>()))
                .Callback<MimeMessage, CancellationToken>((message, _) => sentMessage = message)
                .Returns(Task.CompletedTask);

            await CreateSender().SendAsync(new EmailRequest("<p>Hi</p>", "Subject", "first@example.com", "second@example.com"));

            sentMessage!.To.Mailboxes.Select(mailbox => mailbox.Address)
                .Should().Equal("first@example.com", "second@example.com");
        }

        [Fact]
        public async Task SendAsync_ShouldDisconnectAfterSending()
        {
            await CreateSender().SendAsync(SampleEmail());

            this.clientMock.Verify(client => client.DisconnectAsync(true, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SendAsync_ShouldPassTheCancellationTokenToTheSmtpClient()
        {
            using var cancellationTokenSource = new CancellationTokenSource();
            var token = cancellationTokenSource.Token;

            await CreateSender().SendAsync(SampleEmail(), token);

            this.clientMock.Verify(client => client.SendAsync(It.IsAny<MimeMessage>(), token), Times.Once);
        }

        [Fact]
        public async Task SendAsync_WhenSmtpClientFails_ShouldReturnErrorResponseInsteadOfThrowing()
        {
            this.clientMock
                .Setup(client => client.SendAsync(It.IsAny<MimeMessage>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new MailKit.Net.Smtp.SmtpCommandException(MailKit.Net.Smtp.SmtpErrorCode.MessageNotAccepted, MailKit.Net.Smtp.SmtpStatusCode.ServiceNotAvailable, "Mailbox unavailable"));

            var response = await CreateSender().SendAsync(SampleEmail());

            response.Failed.Should().BeTrue();
            response.Messages.Should().NotBeEmpty();
        }

        [Fact]
        public async Task SendAsync_WhenSmtpClientFails_ShouldDisposeTheClient()
        {
            this.clientMock
                .Setup(client => client.SendAsync(It.IsAny<MimeMessage>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("smtp down"));

            await CreateSender().SendAsync(SampleEmail());

            this.clientMock.Verify(client => client.Dispose(), Times.Once);
        }

        [Fact]
        public async Task SendAsync_WhenConfigurationIsInvalid_ShouldReturnErrorResponseWithoutConnecting()
        {
            this.settings.Host = string.Empty;

            var response = await CreateSender().SendAsync(SampleEmail());

            response.Failed.Should().BeTrue();
            this.clientMock.Verify(client => client.ConnectAsync(
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<SecureSocketOptions>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        private SmtpEmailSender CreateSender()
            => new(Options.Create(this.settings), this.clientFactoryMock.Object, NullLogger<SmtpEmailSender>.Instance);

        private static EmailRequest SampleEmail()
            => new("<html><body><p>Welcome</p></body></html>", "Welcome to EconoFlow", "user@example.com");
    }
}
