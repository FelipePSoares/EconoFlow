using System;
using System.Linq;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.Features.EmailService;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.BackgroundServices.EmailBackgroundService
{
    public class EmailBackgroundService(Channel<EmailRequest> channel, ISmtpEmailSender smtpEmailSender, ILogger<EmailBackgroundService> logger) : BackgroundService
    {
        private readonly Channel<EmailRequest> channel = channel;
        private readonly ISmtpEmailSender smtpEmailSender = smtpEmailSender;
        private readonly ILogger<EmailBackgroundService> logger = logger;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                await foreach (var email in this.channel.Reader.ReadAllAsync(stoppingToken))
                {
                    try
                    {
                        var response = await this.smtpEmailSender.SendAsync(email, stoppingToken);

                        if (response.Succeeded)
                            this.logger.LogInformation("Email sent with subject: {Subject}", email.Subject);
                        else
                            this.logger.LogError("Error sending Email with subject: {Subject}. Errors: {Errors}", email.Subject, string.Join(", ", response.Messages.Select(message => message.Description)));
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        // Host shutdown while the e-mail was in flight: nothing to report.
                    }
                    catch (Exception ex)
                    {
                        this.logger.LogError(ex, "Error sending Email with subject: {Subject}", email.Subject);
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Host shutdown: stop draining the queue.
            }
        }
    }
}
