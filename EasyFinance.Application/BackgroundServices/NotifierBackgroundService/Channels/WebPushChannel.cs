using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.Features.WebPushService;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels
{
    public class WebPushChannel(IWebPushService webPushService, ILogger<WebPushChannel> logger) : INotificationChannel
    {
        private readonly IWebPushService webPushService = webPushService;
        private readonly ILogger<WebPushChannel> logger = logger;

        public async Task<AppResponse> SendAsync(Notification notification)
        {
            var result = await webPushService.SendNotificationAsync(notification, CancellationToken.None);
            if (result.Failed)
            {
                logger.LogWarning(
                    "Failed to send notification {NotificationId} via web push. Errors: {Errors}",
                    notification.Id,
                    string.Join(", ", result.Messages));
            }

            return result;
        }
    }
}
