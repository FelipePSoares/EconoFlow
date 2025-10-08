using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService
{
    public class CompoundNotificationChannel(ILogger<CompoundNotificationChannel> logger) : INotificationChannel
    {
        private readonly List<INotificationChannel> channels = [];
        private readonly ILogger<CompoundNotificationChannel> logger = logger;

        public void AddChannel(INotificationChannel channel) => channels.Add(channel);

        public async Task<AppResponse> SendAsync(Notification notification)
        {
            if (channels.Count == 0)
            {
                this.logger.LogWarning("No notification channels configured. Skipping notification {NotificationId}."
                    , notification.Id);
                return AppResponse.Success();
            }

            var tasks = new List<Task<AppResponse>>();

            foreach (var channel in channels)
                tasks.Add(channel.SendAsync(notification));

            var responses = await Task.WhenAll(tasks);

            if (responses.All(t => t.Succeeded))
            {
                this.logger.LogInformation("Notification {NotificationId} sent successfully in all channels.", notification.Id);
                return AppResponse.Success();
            }

            if (responses.Any(t => t.Succeeded))
            {
                this.logger.LogInformation("Notification {NotificationId} sent successfully in some channels.", notification.Id);
                this.logger.LogWarning("Failed to send notification {NotificationId}. Errors: {Errors}"
                    , notification.Id
                    , string.Join(", ", responses.Where(r => r.Failed).Select(r => r.Messages)));
                return AppResponse.Success();
            }

            this.logger.LogWarning("Failed to send notification {NotificationId} in all channels.", notification.Id);
            return AppResponse.Error("Failed to send notification in all channels.");
        }
    }
}
