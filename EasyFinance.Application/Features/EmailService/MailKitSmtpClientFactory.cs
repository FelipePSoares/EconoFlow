using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Features.EmailService
{
    /// <summary>Creates MailKit SMTP clients configured from <see cref="SmtpSettings"/>.</summary>
    public class MailKitSmtpClientFactory(IOptions<SmtpSettings> settings) : ISmtpClientFactory
    {
        private readonly IOptions<SmtpSettings> settings = settings;

        public ISmtpClient Create() => new MailKitSmtpClient(this.settings.Value.TimeoutSeconds);
    }
}
