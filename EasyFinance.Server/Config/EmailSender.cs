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
                                   ? "Email queued successfully!"
                                   : "Failure in queuing email");
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
            <html lang=""en"">
            <head>
            <meta charset=""UTF-8"">
            <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
            <style>
                body {
                    margin: 0;
                    font-family: Arial, sans-serif;
                    background-color: #052941; /* Dark green background */
                    display: flex;
                    flex-direction: column; /* Corrected to 'column' */
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    text-align: center; /* Center the title and content */
                }
        
                .container {
                    max-width: 600px;
                    width: 100%;
                    background-color: white; /* White inner container */
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
        
                .title {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
        
                .footer svg {
                    height: 40px;
                    color:  #02735f; /* SVG color matching the background */
                }
        
                .title h2 {
                    margin: 0;
                    color: white; /* Text color matching the background */
                    font-size: 40px;
                }
        
                h1 {
                    color: #02735f;
                    font-size: 24px;
                    margin-top: 10px;
                }
        
                p {
                    color: #02735f;
                    font-size: 16px;
                    line-height: 1.5;
                    text-align: left; /* Align text center */
                }
        
                .button {
                    display: flex;
                    justify-content: center;
                    margin-top: 30px;
                }
        
                .button a {
                    background-color: #038c3e;
                    color: white;
                    font-size: 16px;
                    text-decoration: none;
                    border-radius: 5px;
                    padding: 15px 25px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    transition: background-color 0.3s ease;
                }
        
                .button a:hover {
                    background-color: #035940;
                }
        
                hr {
                    border-top: 1px solid #ddd;
                    margin: 30px 0;
                }
        
                .footer {
                    font-size: 12px;
                    color: #02735f;
                    text-align: center; /* Centered footer text */
                }
        
                .footer a {
                    color: #0d6efd;
                    text-decoration: none;
                }
                .last {
        	    	display: flex;
                  	gap:10px;
                  	align-items: center;
                    justify-content: center;
        	    	}
            </style>
            </head>
            <body>
                <div class=""title"">
                    <h2>EconoFlow</h2>
                </div>
                <div class=""container"">
                    <h1>Please follow the instructions in this email, 👋</h1>
                    <h1>{{subject}}</h1>
                    <p>{{message}}</p>
                  
                    <div class=""button"">
                        <a href=""{{callbackUrl}}"">Click here to proceed</a>
                    </div>
                    <p>Thank you for joining!</p>
                    <hr>
                    <div class=""footer"">
                      <div class=""last"">
                      <svg xmlns=""http://www.w3.org/2000/svg"" fill="" #02735f"" viewBox=""0 0 16 16"" class=""bi bi-cash-coin"">
                        <path fill-rule=""evenodd"" d=""M11 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8m5-4a5 5 0 1 1-10 0 5 5 0 0 1 10 0""></path>
                        <path d=""M9.438 11.944c.047.596.518 1.06 1.363 1.116v.44h.375v-.443c.875-.061 1.386-.529 1.386-1.207 0-.618-.39-.936-1.09-1.1l-.296-.07v-1.2c.376.043.614.248.671.532h.658c-.047-.575-.54-1.024-1.329-1.073V8.5h-.375v.45c-.747.073-1.255.522-1.255 1.158 0 .562.378.92 1.007 1.066l.248.061v1.272c-.384-.058-.639-.27-.696-.563h-.668zm1.36-1.354c-.369-.085-.569-.26-.569-.522 0-.294.216-.514.572-.578v1.1zm.432.746c.449.104.655.272.655.569 0 .339-.257.571-.709.614v-1.195z""></path>
                        <path d=""M1 0a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4.083q.088-.517.258-1H3a2 2 0 0 0-2-2V3a2 2 0 0 0 2-2h10a2 2 0 0 0 2 2v3.528c.38.34.717.728 1 1.154V1a1 1 0 0 0-1-1z""></path>
                        <path d=""M9.998 5.083 10 5a2 2 0 1 0-3.132 1.65 6 6 0 0 1 3.13-1.567""></path>
                        </svg>
                        <h1>EconoFlow</h1>
                      </div>
                        <p>If you didn't request this action, please ignore this email.</p>
                        <p>For support, visit <a href=""https://www.econoflow.pt/"">EconoFlow</a>.</p>
                    </div>
                </div>
            </body>
            </html>
        ";
    }
}       