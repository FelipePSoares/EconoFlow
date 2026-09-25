namespace EasyFinance.Application.Features.EmailService
{
    /// <summary>
    /// Creates a fresh <see cref="ISmtpClient"/> per e-mail so a failing connection
    /// can never poison the next send. Implemented by <see cref="MailKitSmtpClientFactory"/>.
    /// </summary>
    public interface ISmtpClientFactory
    {
        ISmtpClient Create();
    }
}
