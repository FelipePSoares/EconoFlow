using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Identity;
using EasyFinance.Infrastructure.Extensions;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.EmailService
{
    public class EmailService(IEmailSender emailSender, IUserService userService, UserManager<User> userManager) : IEmailService
    {
        private const string PublicBaseUrlEnvironmentVariable = "EconoFlow_PUBLIC_BASE_URL";
        private const string FallbackPublicBaseUrl = "https://www.econoflow.pt";

        private readonly IEmailSender emailSender = emailSender;
        private readonly IUserService userService = userService;
        private readonly UserManager<User> userManager = userManager;

        public Task<AppResponse> SendEmailAsync(Guid userId, string toEmail, EmailTemplates template, CultureInfo cultureInfo, params (string token, string replaceWith)[] tokens)
            => this.SendEmailAsyncInternal(userId, toEmail, template, cultureInfo, tokens);

        public Task<AppResponse> SendEmailAsync(string toEmail, EmailTemplates template, CultureInfo cultureInfo, params (string token, string replaceWith)[] tokens)
            => this.SendEmailAsyncInternal(null, toEmail, template, cultureInfo, tokens);

        private Task<AppResponse> SendEmailAsyncInternal(Guid? userId, string toEmail, EmailTemplates template, CultureInfo cultureInfo, params (string token, string replaceWith)[] tokens)
        {
            return template switch
            {
                EmailTemplates.ResetPassword => CreateResetPasswordEmail(userId, toEmail, template, tokens),
                EmailTemplates.ConfirmEmail => CreateConfirmationEmail(userId, toEmail, template, tokens),
                _ => CreateEmail(userId, toEmail, template, cultureInfo, tokens),
            };
        }

        private async Task<AppResponse> CreateEmail(Guid? userId, string toEmail, EmailTemplates template, CultureInfo cultureInfo, (string token, string replaceWith)[] tokens)
        {
            var unsubscribeUrl = await BuildUnsubscribeUrlAsync(userId, toEmail);
            var allTokens = tokens
                .Concat([("unsubscribeUrl", unsubscribeUrl)])
                .ToArray();

            var bodyHtml = LoadHtmlTemplate(template, cultureInfo, allTokens);

            var subject = bodyHtml.GetHtmlTitle();

            await emailSender.SendEmailAsync(toEmail, subject, bodyHtml);
            return AppResponse.Success();
        }

        private Task<AppResponse> CreateConfirmationEmail(Guid? userId, string toEmail, EmailTemplates template, (string token, string replaceWith)[] tokens)
        {
            throw new NotImplementedException();
        }

        private Task<AppResponse> CreateResetPasswordEmail(Guid? userId, string toEmail, EmailTemplates template, (string token, string replaceWith)[] tokens)
        {
            throw new NotImplementedException();
        }

        private static string LoadHtmlTemplate(EmailTemplates templateName, CultureInfo cultureInfo, (string token, string replaceWith)[] tokens)
        {
            var filePath = Path.Combine(AppContext.BaseDirectory, "EmailTemplates", cultureInfo.TwoLetterISOLanguageName, $"{templateName}.html");

            if (!System.IO.File.Exists(filePath))
                filePath = Path.Combine(AppContext.BaseDirectory, "EmailTemplates", "en", $"{templateName}.html");

            var htmlTemplate = System.IO.File.ReadAllText(filePath);

            htmlTemplate = htmlTemplate.ReplaceTokens(tokens);

            return htmlTemplate;
        }

        private async Task<string> BuildUnsubscribeUrlAsync(Guid? userId, string toEmail)
        {
            var baseUrl = (Environment.GetEnvironmentVariable(PublicBaseUrlEnvironmentVariable) ?? FallbackPublicBaseUrl).TrimEnd('/');
            var resolvedUserId = userId;

            if (!resolvedUserId.HasValue || resolvedUserId.Value == Guid.Empty)
            {
                var user = await this.userManager.FindByEmailAsync(toEmail);
                resolvedUserId = user?.Id;
            }

            if (!resolvedUserId.HasValue || resolvedUserId.Value == Guid.Empty)
                return "#";

            var signature = this.userService.GenerateUnsubscribeSignature(resolvedUserId.Value);
            return $"{baseUrl}/api/AccessControl/unsubscribe?userId={resolvedUserId.Value}&signature={Uri.EscapeDataString(signature)}";
        }
    }
}
