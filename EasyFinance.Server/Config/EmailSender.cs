using System.Globalization;
using System.Text.RegularExpressions;
using EasyFinance.Application.DTOs.Email;
using EasyFinance.Application.Features.CallbackService;
using EasyFinance.Infrastructure.Extensions;
using Microsoft.AspNetCore.Identity.UI.Services;
using Smtp2Go.Api;
using Smtp2Go.Api.Models.Emails;

namespace EasyFinance.Server.Config
{
    public class EmailSender : IEmailSender
    {
        private static readonly Regex ConfirmationRegex = new(@"<a href='(.+?)'", RegexOptions.Compiled);

        private readonly ILogger logger;
        private readonly IApiService apiService;
        private readonly ICallbackService callbackService;

        public EmailSender(ILogger<EmailSender> logger, IApiService apiService, ICallbackService callbackService)
        {
            this.logger = logger;
            this.apiService = apiService;
            this.callbackService = callbackService;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string message)
        {
            EmailMessage msg = subject switch
            {
                "Reset your password" => CreateResetPasswordEmail(toEmail, message),
                "Confirm your email" => CreateConfirmationEmail(toEmail, message),
                _ => CreateEmail(toEmail, subject, message),
            };
            var response = await apiService.SendEmail(msg);

            if (response.Data.Succeeded > 0)
                this.logger.LogInformation("Email queued successfully!");
            else
                this.logger.LogWarning("Failure in queuing email");
        }

        private EmailMessage CreateResetPasswordEmail(string toEmail, string body)
        {
            var token = body.Replace("Please reset your password using the following code: ", "");

            var callbackUrl = this.callbackService.GenerateCallbackUrl("recovery", new Dictionary<string, string>
            {
                { "email", toEmail },
                { "token", token }
            });

            body = LoadHtmlTemplate(EmailTemplates.ResetPassword, ("callbackUrl", callbackUrl));

            var subject = body.GetHtmlTitle();

            return CreateEmail(toEmail, subject, body);
        }

        private EmailMessage CreateConfirmationEmail(string toEmail, string body)
        {
            var url = ConfirmationRegex.Match(body);
            body = LoadHtmlTemplate(EmailTemplates.ConfirmEmail, ("callbackUrl", url.Groups[1].Value));

            var subject = body.GetHtmlTitle();

            return CreateEmail(toEmail, subject, body);
        }

        private static EmailMessage CreateEmail(string toEmail, string subject, string bodyHtml) 
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