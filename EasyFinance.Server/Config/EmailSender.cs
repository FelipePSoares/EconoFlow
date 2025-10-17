using System.Globalization;
using System.Text.RegularExpressions;
using System.Threading.Channels;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.Features.CallbackService;
using EasyFinance.Infrastructure.Extensions;
using Microsoft.AspNetCore.Identity.UI.Services;

namespace EasyFinance.Server.Config
{
    public class EmailSender(ILogger<EmailSender> logger, Channel<EmailRequest> channel, ICallbackService callbackService) : IEmailSender
    {
        private static readonly Regex ConfirmationRegex = new(@"<a href='(.+?)'", RegexOptions.Compiled);

        private readonly ILogger logger = logger;

        public async Task SendEmailAsync(string toEmail, string subject, string message)
        {
            EmailRequest msg = subject switch
            {
                "Reset your password" => CreateResetPasswordEmail(toEmail, message),
                "Confirm your email" => CreateConfirmationEmail(toEmail, message),
                _ => CreateEmail(toEmail, subject, message),
            };

            await channel.Writer.WriteAsync(msg);
            this.logger.LogInformation("Email queued with subject: {Subject}", subject);
        }

        private EmailRequest CreateResetPasswordEmail(string toEmail, string body)
        {
            var token = body.Replace("Please reset your password using the following code: ", "");

            var callbackUrl = callbackService.GenerateCallbackUrl("recovery", new Dictionary<string, string>
            {
                { "email", toEmail },
                { "token", token }
            });

            body = LoadHtmlTemplate(EmailTemplates.ResetPassword, ("callbackUrl", callbackUrl));

            var subject = body.GetHtmlTitle();

            return CreateEmail(toEmail, subject, body);
        }

        private EmailRequest CreateConfirmationEmail(string toEmail, string body)
        {
            var url = ConfirmationRegex.Match(body);
            body = LoadHtmlTemplate(EmailTemplates.ConfirmEmail, ("callbackUrl", url.Groups[1].Value));

            var subject = body.GetHtmlTitle();

            return CreateEmail(toEmail, subject, body);
        }

        private static EmailRequest CreateEmail(string toEmail, string subject, string bodyHtml) 
            => new(bodyHtml, subject, "NoReply Econoflow <noreply@econoflow.pt>", toEmail);

        private static string LoadHtmlTemplate(EmailTemplates templateName, params (string token, string replaceWith)[] tokens)
        {
            var culture = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
            var filePath = Path.Combine(AppContext.BaseDirectory, "EmailTemplates", culture, $"{templateName}.html");

            if (!System.IO.File.Exists(filePath))
                filePath = Path.Combine(AppContext.BaseDirectory, "EmailTemplates", "en", $"{templateName}.html");

            var htmlTemplate = System.IO.File.ReadAllText(filePath);

            htmlTemplate = htmlTemplate.ReplaceTokens(tokens);

            return htmlTemplate;
        }
    }
}