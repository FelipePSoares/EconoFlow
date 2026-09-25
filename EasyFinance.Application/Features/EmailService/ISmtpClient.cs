using System;
using System.Threading;
using System.Threading.Tasks;
using MailKit.Security;
using MimeKit;

namespace EasyFinance.Application.Features.EmailService
{
    /// <summary>
    /// Thin seam over the MailKit SMTP client. It exists so
    /// <see cref="SmtpEmailSender"/> can be unit-tested without a real SMTP server.
    /// </summary>
    public interface ISmtpClient : IDisposable
    {
        Task ConnectAsync(string host, int port, SecureSocketOptions secureSocketOptions, CancellationToken cancellationToken = default);

        Task AuthenticateAsync(string username, string password, CancellationToken cancellationToken = default);

        Task SendAsync(MimeMessage message, CancellationToken cancellationToken = default);

        Task DisconnectAsync(bool quit, CancellationToken cancellationToken = default);
    }
}
