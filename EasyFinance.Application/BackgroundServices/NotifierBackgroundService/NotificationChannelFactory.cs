using System;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Application.Features.WebPushService;
using EasyFinance.Domain.Account;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService
{
    public class NotificationChannelFactory(IServiceProvider serviceProvider)
    {
        private readonly IServiceProvider serviceProvider = serviceProvider;

        public CompoundNotificationChannel Create(NotificationChannels channels)
        {
            var compoundChannel = serviceProvider.GetRequiredService<CompoundNotificationChannel>();
            var webPushOptions = serviceProvider.GetService<IOptions<WebPushOptions>>()?.Value;
            var appPushConfigured = webPushOptions?.AppPushConfigured ?? false;
            var webPushAdded = false;

            if (channels.HasFlag(NotificationChannels.Email))
                compoundChannel.AddChannel(serviceProvider.GetRequiredService<EmailChannel>());

            if (channels.HasFlag(NotificationChannels.Sms))
                compoundChannel.AddChannel(serviceProvider.GetRequiredService<SmsChannel>());

            if (channels.HasFlag(NotificationChannels.Push))
            {
                if (appPushConfigured)
                    compoundChannel.AddChannel(serviceProvider.GetRequiredService<PushChannel>());
                else
                {
                    compoundChannel.AddChannel(serviceProvider.GetRequiredService<WebPushChannel>());
                    webPushAdded = true;
                }
            }

            if (channels.HasFlag(NotificationChannels.WebPush) && !webPushAdded)
                compoundChannel.AddChannel(serviceProvider.GetRequiredService<WebPushChannel>());

            return compoundChannel;
        }
    }
}
