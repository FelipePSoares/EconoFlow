using System.Globalization;
using System.Text.RegularExpressions;
using System.Threading.Channels;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.Features.CallbackService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.Extensions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;

namespace EasyFinance.Server.Config
{
    public class EmailSender(
        ILogger<EmailSender> logger,
        Channel<EmailRequest> channel,
        ICallbackService callbackService,
        UserManager<User> userManager,
        IUserService userService) : IEmailSender
    {
        private static readonly Regex ConfirmationRegex = new(@"<a href='(.+?)'", RegexOptions.Compiled);
        private const string PublicBaseUrlEnvironmentVariable = "EconoFlow_PUBLIC_BASE_URL";
        private const string FallbackPublicBaseUrl = "https://www.econoflow.pt";

        private readonly ILogger logger = logger;
        private readonly UserManager<User> userManager = userManager;
        private readonly IUserService userService = userService;

        public async Task SendEmailAsync(string toEmail, string subject, string message)
        {
            EmailRequest msg;
            if (subject == "Reset your password")
                msg = await CreateResetPasswordEmailAsync(toEmail, message);
            else if (subject == "Confirm your email")
                msg = await CreateConfirmationEmailAsync(toEmail, message);
            else
                msg = CreateEmail(toEmail, subject, message);

            await channel.Writer.WriteAsync(msg);
            this.logger.LogInformation("Email queued with subject: {Subject}", subject);
        }

        private async Task<EmailRequest> CreateResetPasswordEmailAsync(string toEmail, string body)
        {
            var token = body.Replace("Please reset your password using the following code: ", "");

            var callbackUrl = callbackService.GenerateCallbackUrl("recovery", new Dictionary<string, string>
            {
                { "email", toEmail },
                { "token", token }
            });

            body = LoadHtmlTemplate(EmailTemplates.ResetPassword,
                ("callbackUrl", callbackUrl),
                ("unsubscribeUrl", await BuildUnsubscribeUrlAsync(toEmail)));

            var subject = body.GetHtmlTitle();

            return CreateEmail(toEmail, subject, body);
        }

        private async Task<EmailRequest> CreateConfirmationEmailAsync(string toEmail, string body)
        {
            var url = ConfirmationRegex.Match(body);
            body = LoadHtmlTemplate(EmailTemplates.ConfirmEmail,
                ("callbackUrl", url.Groups[1].Value),
                ("unsubscribeUrl", await BuildUnsubscribeUrlAsync(toEmail)));

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

        private async Task<string> BuildUnsubscribeUrlAsync(string email)
        {
            var baseUrl = (Environment.GetEnvironmentVariable(PublicBaseUrlEnvironmentVariable) ?? FallbackPublicBaseUrl).TrimEnd('/');
            var user = await this.userManager.FindByEmailAsync(email);

            if (user == null || user.Id == Guid.Empty)
                return "#";

            var signature = this.userService.GenerateUnsubscribeSignature(user.Id);
            return $"{baseUrl}/api/AccessControl/unsubscribe?userId={user.Id}&signature={Uri.EscapeDataString(signature)}";
        }
    }
}
