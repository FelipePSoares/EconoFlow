using Microsoft.AspNetCore.Identity.UI.Services;
using SendGrid;
using SendGrid.Helpers.Mail;
using System.Text.RegularExpressions;

namespace EasyFinance.Server.Config
{
    public class EmailSender : IEmailSender
    {
        private readonly ILogger logger;
        private readonly ISendGridClient sendGridClient;
        private readonly IHttpContextAccessor httpContextAccessor;

        public EmailSender(ILogger<EmailSender> logger, ISendGridClient sendGridClient, IHttpContextAccessor httpContextAccessor)
        {
            this.logger = logger;
            this.sendGridClient = sendGridClient;
            this.httpContextAccessor = httpContextAccessor;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string message)
        {
            SendGridMessage msg;

            if (subject == "Reset your password")
                msg = createResetPasswordEmail(toEmail, subject, message);
            else if (subject == "Confirm your email")
                msg = CreateConfirmationEmail(toEmail, subject, message);
            else
                msg = createDefaultEmail(toEmail, subject, message);

            var response = await sendGridClient.SendEmailAsync(msg);
            this.logger.LogInformation(response.IsSuccessStatusCode
                                   ? $"Email to {toEmail} queued successfully!"
                                   : $"Failure Email to {toEmail}");
        }

        private SendGridMessage createDefaultEmail(string toEmail, string subject, string message)
        {
            var msg = new SendGridMessage()
            {
                From = new EmailAddress("noreply@econoflow.pt", "NoReply Econoflow"),
                Subject = subject,
                PlainTextContent = message,
                HtmlContent = message
            };
            msg.AddTo(new EmailAddress(toEmail));

            return msg;
        }

        private SendGridMessage CreateConfirmationEmail(string toEmail, string subject, string message)
        {
            var regex = new Regex(@"<a href='(.+?)'");

            var url = regex.Match(message);

            var email = this.Format(subject, "Please confirm your account by clicking the button below.", url.Groups[1].Value);

            return createDefaultEmail(toEmail, subject, email);
        }

        private SendGridMessage createResetPasswordEmail(string toEmail, string subject, string message)
        {
            var token = ExtractResetPasswordToken(message);

            var request = this.httpContextAccessor.HttpContext.Request;
            var callbackUrl = new UriBuilder($"{request.Scheme}://{request.Host}/recovery");

            callbackUrl.Query = $"?email={toEmail}&token={token}";

            message = Format(subject, "Please reset your password by clicking the button below.", callbackUrl.Uri.AbsoluteUri);

            return this.createDefaultEmail(toEmail, subject, message);
        }

        private string Format(string subject, string message, string callbackUrl)
        {
            return this.htmlTemplateWithButton
                            .Replace("{{subject}}", subject)
                            .Replace("{{message}}", message)
                            .Replace("{{callbackUrl}}", callbackUrl);
        }

        private string ExtractResetPasswordToken(string message)
        {
            return message.Replace("Please reset your password using the following code: ", "");
        }

        string htmlTemplateWithButton = @"
            <!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f2f2f2; padding: 20px; }
                    .container { max-width: 600px;  text-align: center;  background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                    .title { display: flex; justify-content: center; align-items: center; }
                    .title h2 { display: inline-block; margin: 0; font-size: 30px; font-weight: normal; margin-left: 10px; }
                    h1 { color: #333; }
                    p { color: #666; }
                    .button { display: inline-block; width: 100%; text-align: center; }
                    .button a { background-color: #0d6efd; color: white; text-decoration: none; border-radius: 5px; padding: 10px 20px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='title'>
                        <span>
                            <svg xmlns='http://www.w3.org/2000/svg' fill='currentColor' viewBox='0 0 16 16' class='bi bi-cash-coin' style='height: 50px;'><path fill-rule='evenodd' d='M11 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8m5-4a5 5 0 1 1-10 0 5 5 0 0 1 10 0'></path><path _ngcontent-ng-c3601908439='' d='M9.438 11.944c.047.596.518 1.06 1.363 1.116v.44h.375v-.443c.875-.061 1.386-.529 1.386-1.207 0-.618-.39-.936-1.09-1.1l-.296-.07v-1.2c.376.043.614.248.671.532h.658c-.047-.575-.54-1.024-1.329-1.073V8.5h-.375v.45c-.747.073-1.255.522-1.255 1.158 0 .562.378.92 1.007 1.066l.248.061v1.272c-.384-.058-.639-.27-.696-.563h-.668zm1.36-1.354c-.369-.085-.569-.26-.569-.522 0-.294.216-.514.572-.578v1.1zm.432.746c.449.104.655.272.655.569 0 .339-.257.571-.709.614v-1.195z'></path><path _ngcontent-ng-c3601908439='' d='M1 0a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4.083q.088-.517.258-1H3a2 2 0 0 0-2-2V3a2 2 0 0 0 2-2h10a2 2 0 0 0 2 2v3.528c.38.34.717.728 1 1.154V1a1 1 0 0 0-1-1z'></path><path _ngcontent-ng-c3601908439='' d='M9.998 5.083 10 5a2 2 0 1 0-3.132 1.65 6 6 0 0 1 3.13-1.567'></path></svg>
                        </span>
                        <h2>EconoFlow</h2>
                    </div>
                    <hr style='border-top: 3px solid #bbb;'>
                    <h1>{{subject}}</h1>
                    <p>{{message}}</p>
                    <div class='button'>
                        <a href='{{callbackUrl}}'>Click here to proceed</a>
                    </div>
                </div>
            </body>
            </html>";
    }
}
