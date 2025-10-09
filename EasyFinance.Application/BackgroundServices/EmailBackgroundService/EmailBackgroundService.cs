using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Smtp2Go.Api;

namespace EasyFinance.Application.BackgroundServices.EmailBackgroundService
{
    public class EmailBackgroundService(Channel<EmailRequest> channel, IApiService apiService, ILogger<EmailBackgroundService> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await foreach (var email in channel.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    var response = await apiService.SendEmail(email.BodyHtml, email.Subject, email.Sender, email.To);

                    if (response.Data.Succeeded > 0)
                        logger.LogInformation("Email sended successfully!");
                    else
                        logger.LogError("Error sending Email with subject: {Subject}", email.Subject);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error sending Email with subject: {Subject}", email.Subject);
                }
            }
        }
    }
}

