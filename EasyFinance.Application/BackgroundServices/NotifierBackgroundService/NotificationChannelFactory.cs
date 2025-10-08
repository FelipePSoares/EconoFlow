using System;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Domain.Account;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService
{
    public class NotificationChannelFactory(IServiceProvider serviceProvider)
    {
        private readonly IServiceProvider _serviceProvider = serviceProvider;

        public CompoundNotificationChannel Create(NotificationChannels channels)
        {
            var compoundChannel = _serviceProvider.GetRequiredService<CompoundNotificationChannel>();

            if (channels.HasFlag(NotificationChannels.Email))
                compoundChannel.AddChannel(_serviceProvider.GetRequiredService<EmailChannel>());

            if (channels.HasFlag(NotificationChannels.Sms))
                compoundChannel.AddChannel(_serviceProvider.GetRequiredService<SmsChannel>());

            if (channels.HasFlag(NotificationChannels.Push))
                compoundChannel.AddChannel(_serviceProvider.GetRequiredService<PushChannel>());

            return compoundChannel;
        }
    }
}
