using System.Threading.Tasks;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels
{
    public class PushChannel(ILogger<PushChannel> logger) : INotificationChannel
    {
        private readonly ILogger<PushChannel> logger = logger;

        public Task<AppResponse> SendAsync(Notification notification)
        {
            logger.LogWarning("Push sending is not implemented yet.");
            return Task.FromResult(AppResponse.Success());
        }
    }
}
