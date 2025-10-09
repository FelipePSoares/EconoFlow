using System.Threading.Tasks;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels
{
    public class SmsChannel(ILogger<SmsChannel> logger) : INotificationChannel
    {
        private readonly ILogger<SmsChannel> logger = logger;

        public Task<AppResponse> SendAsync(Notification notification)
        {
            logger.LogWarning("SMS sending is not implemented yet.");
            return Task.FromResult(AppResponse.Success());
        }
    }
}
