using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Email;

namespace EasyFinance.Application.Features.EmailService
{
    public interface IEmailService
    {
        Task SendEmailAsync(string toEmail, EmailTemplates template, params (string token, string replaceWith)[] tokens);
    }
}
