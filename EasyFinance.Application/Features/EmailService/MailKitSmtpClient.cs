using System.Threading;
using System.Threading.Tasks;
using MailKit.Security;
using MimeKit;

namespace EasyFinance.Application.Features.EmailService
{
    /// <summary>MailKit-backed <see cref="ISmtpClient"/>.</summary>
    public class MailKitSmtpClient : ISmtpClient
    {
        private const int MillisecondsPerSecond = 1000;

        private readonly MailKit.Net.Smtp.SmtpClient client = new();

        public MailKitSmtpClient(int timeoutSeconds)
        {
            if (timeoutSeconds > 0)
                this.client.Timeout = timeoutSeconds * MillisecondsPerSecond;
        }

        public Task ConnectAsync(string host, int port, SecureSocketOptions secureSocketOptions, CancellationToken cancellationToken = default)
            => this.client.ConnectAsync(host, port, secureSocketOptions, cancellationToken);

        public Task AuthenticateAsync(string username, string password, CancellationToken cancellationToken = default)
            => this.client.AuthenticateAsync(username, password, cancellationToken);

        public Task SendAsync(MimeMessage message, CancellationToken cancellationToken = default)
            => this.client.SendAsync(message, cancellationToken);

        public Task DisconnectAsync(bool quit, CancellationToken cancellationToken = default)
            => this.client.DisconnectAsync(quit, cancellationToken);

        public void Dispose()
        {
            this.client.Dispose();
            System.GC.SuppressFinalize(this);
        }
    }
}
