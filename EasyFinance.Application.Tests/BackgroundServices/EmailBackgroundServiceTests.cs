using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using EasyFinance.Application.BackgroundServices.EmailBackgroundService;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.Features.EmailService;
using FluentAssertions;
using FpsSoftware.Chassis;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace EasyFinance.Application.Tests.BackgroundServices
{
    public class EmailBackgroundServiceTests
    {
        private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

        private readonly Channel<EmailRequest> channel = Channel.CreateUnbounded<EmailRequest>();
        private readonly Mock<ISmtpEmailSender> smtpEmailSenderMock = new();

        [Fact]
        public async Task ExecuteAsync_WhenEmailIsQueued_ShouldSendItThroughTheSmtpSender()
        {
            var email = SampleEmail();
            var sent = new TaskCompletionSource<EmailRequest>(TaskCreationOptions.RunContinuationsAsynchronously);
            this.smtpEmailSenderMock
                .Setup(sender => sender.SendAsync(It.IsAny<EmailRequest>(), It.IsAny<CancellationToken>()))
                .Callback<EmailRequest, CancellationToken>((request, _) => sent.TrySetResult(request))
                .ReturnsAsync(AppResponse.Success());

            var service = await StartServiceAsync();

            await this.channel.Writer.WriteAsync(email);

            var received = await sent.Task.WaitAsync(Timeout);

            received.Should().BeSameAs(email);
        }

        [Fact]
        public async Task ExecuteAsync_WhenEmailIsQueued_ShouldPassTheStoppingTokenToTheSender()
        {
            var receivedToken = new TaskCompletionSource<CancellationToken>(TaskCreationOptions.RunContinuationsAsynchronously);
            this.smtpEmailSenderMock
                .Setup(sender => sender.SendAsync(It.IsAny<EmailRequest>(), It.IsAny<CancellationToken>()))
                .Callback<EmailRequest, CancellationToken>((_, cancellationToken) => receivedToken.TrySetResult(cancellationToken))
                .ReturnsAsync(AppResponse.Success());

            var service = await StartServiceAsync();

            await this.channel.Writer.WriteAsync(SampleEmail());

            var token = await receivedToken.Task.WaitAsync(Timeout);

            token.CanBeCanceled.Should().BeTrue();
            token.IsCancellationRequested.Should().BeFalse();
        }

        [Fact]
        public async Task ExecuteAsync_WhenSmtpSenderReturnsError_ShouldKeepProcessingTheQueue()
        {
            var processed = new ConcurrentQueue<EmailRequest>();
            var secondEmailSent = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            this.smtpEmailSenderMock
                .Setup(sender => sender.SendAsync(It.IsAny<EmailRequest>(), It.IsAny<CancellationToken>()))
                .Callback<EmailRequest, CancellationToken>((request, _) =>
                {
                    processed.Enqueue(request);
                    if (processed.Count == 2)
                        secondEmailSent.TrySetResult(true);
                })
                .ReturnsAsync(AppResponse.Error("SMTP server unavailable"));

            var service = await StartServiceAsync();

            await this.channel.Writer.WriteAsync(SampleEmail());
            await this.channel.Writer.WriteAsync(SampleEmail());

            await secondEmailSent.Task.WaitAsync(Timeout);

            processed.Should().HaveCount(2);
        }

        [Fact]
        public async Task ExecuteAsync_WhenSmtpSenderThrows_ShouldContinueWithTheNextEmail()
        {
            var processed = new ConcurrentQueue<EmailRequest>();
            var secondEmailSent = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            this.smtpEmailSenderMock
                .Setup(sender => sender.SendAsync(It.IsAny<EmailRequest>(), It.IsAny<CancellationToken>()))
                .Returns<EmailRequest, CancellationToken>((request, _) =>
                {
                    processed.Enqueue(request);
                    if (processed.Count == 1)
                        throw new InvalidOperationException("unexpected SMTP failure");

                    secondEmailSent.TrySetResult(true);
                    return Task.FromResult(AppResponse.Success());
                });

            var service = await StartServiceAsync();

            await this.channel.Writer.WriteAsync(SampleEmail());
            await this.channel.Writer.WriteAsync(SampleEmail());

            await secondEmailSent.Task.WaitAsync(Timeout);

            processed.Should().HaveCount(2);
        }

        [Fact]
        public async Task ExecuteAsync_WhileWaitingForEmails_ShouldNotInvokeTheSmtpSender()
        {
            var service = await StartServiceAsync();

            await Task.Delay(50);

            this.smtpEmailSenderMock.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task StopAsync_WhenCalled_ShouldCompleteWithoutErrors()
        {
            var service = await StartServiceAsync();

            var stop = async () => await service.StopAsync(CancellationToken.None);

            await stop.Should().NotThrowAsync();
        }

        [Fact]
        public async Task ExecuteAsync_WhenStoppingWhileAnEmailIsInFlight_ShouldNotLogAnError()
        {
            var inFlight = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            this.smtpEmailSenderMock
                .Setup(sender => sender.SendAsync(It.IsAny<EmailRequest>(), It.IsAny<CancellationToken>()))
                .Returns<EmailRequest, CancellationToken>(async (_, cancellationToken) =>
                {
                    inFlight.TrySetResult(true);
                    await Task.Delay(System.Threading.Timeout.Infinite, cancellationToken);
                    return AppResponse.Success();
                });

            var loggerMock = new Mock<ILogger<EmailBackgroundService>>();
            var service = new EmailBackgroundService(this.channel, this.smtpEmailSenderMock.Object, loggerMock.Object);

            await service.StartAsync(CancellationToken.None);
            await this.channel.Writer.WriteAsync(SampleEmail());
            await inFlight.Task.WaitAsync(Timeout);

            await service.StopAsync(CancellationToken.None);

            loggerMock.Verify(
                logger => logger.Log(
                    LogLevel.Error,
                    It.IsAny<EventId>(),
                    It.IsAny<It.IsAnyType>(),
                    It.IsAny<Exception?>(),
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.Never);
        }

        private async Task<EmailBackgroundService> StartServiceAsync()
        {
            var service = new EmailBackgroundService(
                this.channel,
                this.smtpEmailSenderMock.Object,
                NullLogger<EmailBackgroundService>.Instance);

            await service.StartAsync(CancellationToken.None);

            return service;
        }

        private static EmailRequest SampleEmail()
            => new("<html><body><p>Hi</p></body></html>", "Subject", "user@example.com");
    }
}
