using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.Features.ExpoPushTokenService;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels
{
    public class PushChannel(
        IExpoPushTokenService tokenService,
        IExpoPushClient pushClient,
        ILogger<PushChannel> logger) : INotificationChannel
    {
        private readonly IExpoPushTokenService tokenService = tokenService;
        private readonly IExpoPushClient pushClient = pushClient;
        private readonly ILogger<PushChannel> logger = logger;

        public async Task<AppResponse> SendAsync(Notification notification)
        {
            var tokens = (await tokenService.GetActiveTokensForUserAsync(notification.User.Id)).ToList();

            if (tokens.Count == 0)
            {
                logger.LogDebug("No active Expo push tokens for user {UserId}.", notification.User.Id);
                return AppResponse.Success();
            }

            var culture = notification.User?.Culture ?? CultureInfo.InvariantCulture;
            var body = NotificationMessages.ResourceManager.GetString(notification.CodeMessage, culture)
                       ?? notification.CodeMessage;

            var messages = tokens.Select(token => new ExpoMessage
            {
                To = token,
                Title = "EconoFlow",
                Body = body,
                Data = new { notificationId = notification.Id, category = notification.Category.ToString() },
            });

            var result = await pushClient.SendAsync(messages, CancellationToken.None);

            if (result.Failed)
            {
                var isDeviceNotRegistered = result.Messages
                    .Any(m => m.Code == "DeviceNotRegistered");

                if (isDeviceNotRegistered)
                {
                    foreach (var token in tokens)
                        await tokenService.RevokeTokenAsync(notification.User.Id, token);

                    logger.LogInformation(
                        "Revoked {Count} invalid Expo push token(s) for user {UserId}.",
                        tokens.Count,
                        notification.User.Id);
                }
                else
                {
                    logger.LogWarning(
                        "Failed to send Expo push notification {NotificationId}. Errors: {Errors}",
                        notification.Id,
                        string.Join(", ", result.Messages.Select(m => m.Description)));
                }

                return result;
            }

            return AppResponse.Success();
        }
    }
}
