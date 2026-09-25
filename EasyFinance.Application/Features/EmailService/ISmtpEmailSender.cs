using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using FpsSoftware.Chassis;

namespace EasyFinance.Application.Features.EmailService
{
    /// <summary>Sends an already-rendered e-mail through the configured SMTP server.</summary>
    public interface ISmtpEmailSender
    {
        Task<AppResponse> SendAsync(EmailRequest email, CancellationToken cancellationToken = default);
    }
}
