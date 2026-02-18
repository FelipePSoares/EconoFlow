using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.Features.EmailService;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels
{
    public class EmailChannel(IEmailService emailService, ILogger<EmailChannel> logger) : INotificationChannel
    {
        private readonly IEmailService emailService = emailService;
        private readonly ILogger<EmailChannel> logger = logger;

        public Task<AppResponse> SendAsync(Notification notification)
        {
            if (Enum.TryParse<EmailTemplates>(notification.CodeMessage, out var template))
            {
                return emailService.SendEmailAsync(
                    notification.User.Id,
                    notification.User.Email,
                    template,
                    notification.User.Culture,
                    GetTokens(notification.Metadata)
                );
            }

            logger.LogWarning("Email template {Template} not found", notification.CodeMessage);
            return Task.FromResult(AppResponse.Error("Email template not found"));
        }

        private static (string token, string replaceWith)[] GetTokens(string metadata)
        {
            if (string.IsNullOrWhiteSpace(metadata))
                return [];

            try
            {
                var dict = JsonSerializer.Deserialize<Dictionary<string, string>>(metadata);

                if (dict == null)
                    return [];

                return dict
                    .Select(kv => ($"{{{{{kv.Key}}}}}", kv.Value))
                    .ToArray();
            }
            catch (JsonException)
            {
                return [];
            }
        }
    }
}
