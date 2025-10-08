using System;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Domain.Account;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService
{
    public class NotificationChannelFactory(IServiceProvider serviceProvider)
    {
        private readonly IServiceProvider serviceProvider = serviceProvider;

        public CompoundNotificationChannel Create(NotificationChannels channels)
        {
            var compoundChannel = serviceProvider.GetRequiredService<CompoundNotificationChannel>();

            if (channels.HasFlag(NotificationChannels.Email))
                compoundChannel.AddChannel(serviceProvider.GetRequiredService<EmailChannel>());

            if (channels.HasFlag(NotificationChannels.Sms))
                compoundChannel.AddChannel(serviceProvider.GetRequiredService<SmsChannel>());

            if (channels.HasFlag(NotificationChannels.Push))
                compoundChannel.AddChannel(serviceProvider.GetRequiredService<PushChannel>());

            return compoundChannel;
        }
    }
}
