using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Notification;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService
{
    public class NotifierBackgroundService(
        Channel<NotificationRequest> channel,
        NotificationChannelFactory channelFactory,
        ILogger<NotifierBackgroundService> logger,
        INotificationService notificationService) : BackgroundService
    {
        private readonly NotificationChannelFactory channelFactory = channelFactory;
        private readonly ILogger<NotifierBackgroundService> logger = logger;
        private readonly INotificationService notificationService = notificationService;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await foreach (var notification in channel.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    AppResponse response = await this.SendNotificationAsync(notification.NotificationId, stoppingToken);

                    if (response.Failed)
                        logger.LogError("Failed to send notification {notificationId}", notification.NotificationId);
                }
                catch (TaskCanceledException)
                {
                    // Ignore when the application is stopping
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error when try to execute a schedule task.");
                }
            }
        }

        private async Task<AppResponse> SendNotificationAsync(Guid notificationId, CancellationToken stoppingToken)
        {
            try
            {
                var resultNotification = await notificationService.GetAsync(notificationId, stoppingToken);

                if (resultNotification.Failed)
                {
                    logger.LogError("Failed to retrieve notification {NotificationId}. Errors: {Errors}", notificationId, string.Join(", ", resultNotification.Messages));
                    return AppResponse.Error("Failed to retrieve notification. Errors: " + string.Join(", ", resultNotification.Messages));
                }

                var notification = resultNotification.Data;

                var notificationChannels = notification.LimitNotificationChannels == NotificationChannels.None ? notification.User.NotificationChannels : notification.LimitNotificationChannels & notification.User.NotificationChannels;

                if (notificationChannels == NotificationChannels.None)
                {
                    logger.LogWarning("No notification channels available for user {UserId}. Skipping notification {NotificationId}.", notification.User.Id, notificationId);
                    return AppResponse.Success();
                }

                var compound = channelFactory.Create(notificationChannels);

                return await compound.SendAsync(notification);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An error occurred while sending notification {NotificationId}.", notificationId);
                return AppResponse.Error("An error occurred while sending notification: " + ex.Message);
            }
        }
    }
}
