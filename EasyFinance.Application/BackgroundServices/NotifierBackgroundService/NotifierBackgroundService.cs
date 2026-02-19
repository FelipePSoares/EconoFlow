using System;
using System.Linq;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Notification;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService
{
    public class NotifierBackgroundService(
        Channel<NotificationRequest> channel,
        ILogger<NotifierBackgroundService> logger,
        IServiceProvider serviceProvider,
        IOptions<NotifierFallbackOptions> fallbackOptions) : BackgroundService
    {
        private readonly ILogger<NotifierBackgroundService> logger = logger;
        private readonly IServiceProvider serviceProvider = serviceProvider;
        private readonly NotifierFallbackOptions fallbackOptions = fallbackOptions.Value;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var interval = TimeSpan.FromSeconds(Math.Max(1, fallbackOptions.IntervalSeconds));
            var nextFallbackRun = DateTime.UtcNow;

            while (!stoppingToken.IsCancellationRequested)
            {
                if (DateTime.UtcNow >= nextFallbackRun)
                {
                    await ProcessFallbackBatchAsync(stoppingToken);
                    nextFallbackRun = DateTime.UtcNow.Add(interval);
                }

                var delay = nextFallbackRun - DateTime.UtcNow;
                if (delay < TimeSpan.Zero)
                    delay = TimeSpan.Zero;

                var waitForQueueTask = channel.Reader.WaitToReadAsync(stoppingToken).AsTask();
                var waitForFallbackTask = Task.Delay(delay, stoppingToken);

                var completedTask = await Task.WhenAny(waitForQueueTask, waitForFallbackTask);
                if (completedTask != waitForQueueTask)
                    continue;

                if (!await waitForQueueTask)
                    continue;

                while (channel.Reader.TryRead(out var notificationRequest))
                    await ProcessNotificationAsync(notificationRequest.NotificationId, stoppingToken);
            }
        }

        private async Task ProcessFallbackBatchAsync(CancellationToken stoppingToken)
        {
            try
            {
                using var scope = serviceProvider.CreateScope();
                var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
                var result = await notificationService.GetEmailDeliveryCandidatesAsync(Math.Max(1, fallbackOptions.BatchSize), stoppingToken);

                if (result.Failed)
                {
                    logger.LogError("Failed to retrieve notification fallback candidates. Errors: {Errors}", string.Join(", ", result.Messages));
                    return;
                }

                foreach (var notificationId in result.Data)
                    await ProcessNotificationAsync(notificationId, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                // Ignore when application is stopping
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error when processing notification fallback batch.");
            }
        }

        private async Task ProcessNotificationAsync(Guid notificationId, CancellationToken stoppingToken)
        {
            try
            {
                var response = await SendNotificationAsync(notificationId, stoppingToken);
                if (response.Failed)
                    logger.LogError("Failed to send notification {NotificationId}", notificationId);
            }
            catch (TaskCanceledException)
            {
                // Ignore when application is stopping
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error when processing notification {NotificationId}.", notificationId);
            }
        }

        private async Task<AppResponse> SendNotificationAsync(Guid notificationId, CancellationToken stoppingToken)
        {
            using var scope = serviceProvider.CreateScope();
            var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

            var claimResult = await notificationService.TryClaimEmailDeliveryAsync(
                notificationId,
                TimeSpan.FromSeconds(Math.Max(1, fallbackOptions.LeaseDurationSeconds)),
                stoppingToken);

            if (claimResult.Failed)
                return AppResponse.Success();

            var notification = claimResult.Data;
            var notificationChannels = notification.LimitNotificationChannels == NotificationChannels.None
                ? notification.User.NotificationChannels
                : notification.LimitNotificationChannels & notification.User.NotificationChannels;

            if (!notificationChannels.HasFlag(NotificationChannels.Email))
            {
                return await MarkDeliveryStatusAsync(
                    () => notificationService.MarkEmailDeliverySucceededAsync(notificationId, stoppingToken),
                    notificationId,
                    "sent");
            }

            try
            {
                var compound = new NotificationChannelFactory(scope.ServiceProvider)
                    .Create(notificationChannels & NotificationChannels.Email);

                var sendResult = await compound.SendAsync(notification);
                if (sendResult.Succeeded)
                {
                    return await MarkDeliveryStatusAsync(
                        () => notificationService.MarkEmailDeliverySucceededAsync(notificationId, stoppingToken),
                        notificationId,
                        "sent");
                }

                if (sendResult.Messages.Any(m => string.Equals(m.Description, "Email template not found", StringComparison.OrdinalIgnoreCase)))
                {
                    await MarkDeliveryStatusAsync(
                        () => notificationService.MarkEmailDeliveryAsFailedAsync(notificationId, stoppingToken),
                        notificationId,
                        "failed");
                    return sendResult;
                }

                await MarkDeliveryStatusAsync(
                    () => notificationService.MarkEmailDeliveryAsPendingAsync(notificationId, stoppingToken),
                    notificationId,
                    "pending");
                return sendResult;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An error occurred while sending notification {NotificationId}.", notificationId);
                await MarkDeliveryStatusAsync(
                    () => notificationService.MarkEmailDeliveryAsPendingAsync(notificationId, stoppingToken),
                    notificationId,
                    "pending");
                return AppResponse.Error("An error occurred while sending notification: " + ex.Message);
            }
        }

        private async Task<AppResponse> MarkDeliveryStatusAsync(Func<Task<AppResponse>> markStatus, Guid notificationId, string status)
        {
            var statusResult = await markStatus();
            if (statusResult.Failed)
            {
                logger.LogError(
                    "Failed to mark notification {NotificationId} email delivery as {Status}. Errors: {Errors}",
                    notificationId,
                    status,
                    string.Join(", ", statusResult.Messages.Select(m => m.Description)));
            }

            return statusResult;
        }
    }
}
