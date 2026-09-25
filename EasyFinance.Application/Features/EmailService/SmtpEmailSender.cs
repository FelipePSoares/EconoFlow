using System;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using FpsSoftware.Chassis;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace EasyFinance.Application.Features.EmailService
{
    /// <summary>
    /// Delivers queued e-mails through the SMTP server described by
    /// <see cref="SmtpSettings"/>. Transport failures are reported as an
    /// <see cref="AppResponse"/> error so the calling background service can keep
    /// draining the queue.
    /// </summary>
    public class SmtpEmailSender(
        IOptions<SmtpSettings> settings,
        ISmtpClientFactory smtpClientFactory,
        ILogger<SmtpEmailSender> logger) : ISmtpEmailSender
    {
        private readonly IOptions<SmtpSettings> settings = settings;
        private readonly ISmtpClientFactory smtpClientFactory = smtpClientFactory;
        private readonly ILogger<SmtpEmailSender> logger = logger;

        public async Task<AppResponse> SendAsync(EmailRequest email, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(email);

            var currentSettings = this.settings.Value;

            var validation = currentSettings.Validate;
            if (validation.Failed)
                return AppResponse.Error(validation.Messages);

            if (!currentSettings.TryGetSecureSocketOptions(out var secureSocketOptions))
                return AppResponse.Error($"SMTP secure socket must be one of Auto, None, StartTls, SslOnConnect (set {SmtpSettings.SecureSocketEnvironmentVariable}).");

            try
            {
                using var client = this.smtpClientFactory.Create();

                await client.ConnectAsync(currentSettings.Host, currentSettings.Port, secureSocketOptions, cancellationToken);
                await client.AuthenticateAsync(currentSettings.Username, currentSettings.Password, cancellationToken);
                await client.SendAsync(BuildMessage(currentSettings, email), cancellationToken);
                await client.DisconnectAsync(quit: true, cancellationToken);

                return AppResponse.Success();
            }
            catch (Exception ex)
            {
                this.logger.LogError(ex, "Error sending Email with subject: {Subject}", email.Subject);
                return AppResponse.Error($"Failed to send email with subject '{email.Subject}': {ex.Message}");
            }
        }

        private static MimeMessage BuildMessage(SmtpSettings currentSettings, EmailRequest email)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(currentSettings.FromName, currentSettings.FromAddress));

            foreach (var recipient in email.To)
                message.To.Add(MailboxAddress.Parse(recipient));

            message.Subject = email.Subject;
            message.Body = new TextPart("html") { Text = email.BodyHtml };

            return message;
        }
    }
}
