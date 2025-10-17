using System;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity.UI.Services;
using EasyFinance.Infrastructure.Extensions;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.EmailService
{
    public class EmailService(IEmailSender emailSender) : IEmailService
    {
        private readonly IEmailSender emailSender = emailSender;

        public Task<AppResponse> SendEmailAsync(string toEmail, EmailTemplates template, params (string token, string replaceWith)[] tokens)
        {
            return template switch
            {
                EmailTemplates.ResetPassword => CreateResetPasswordEmail(toEmail, template, tokens),
                EmailTemplates.ConfirmEmail => CreateConfirmationEmail(toEmail, template, tokens),
                _ => CreateEmail(toEmail, template, tokens),
            };
        }

        private Task<AppResponse> CreateEmail(string toEmail, EmailTemplates template, (string token, string replaceWith)[] tokens)
        {
            var bodyHtml = LoadHtmlTemplate(template, tokens);

            var subject = bodyHtml.GetHtmlTitle();

            return emailSender.SendEmailAsync(toEmail, subject, bodyHtml).ContinueWith(result => AppResponse.Success());
        }

        private Task<AppResponse> CreateConfirmationEmail(string toEmail, EmailTemplates template, (string token, string replaceWith)[] tokens)
        {
            throw new NotImplementedException();
        }

        private Task<AppResponse> CreateResetPasswordEmail(string toEmail, EmailTemplates template, (string token, string replaceWith)[] tokens)
        {
            throw new NotImplementedException();
        }

        private static string LoadHtmlTemplate(EmailTemplates templateName, (string token, string replaceWith)[] tokens)
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
