using Microsoft.AspNetCore.Identity.UI.Services;

namespace EasyFinance.Server.Config
{
    public class DevEmailSender(ILogger<DevEmailSender> logger) : IEmailSender
    {
        public Task SendEmailAsync(string email, string subject, string htmlMessage)
        {
            logger.LogInformation(
                "Development mode: skipping email send to {Email} with subject '{Subject}'",
                email, subject);

            return Task.CompletedTask;
        }
    }
}
