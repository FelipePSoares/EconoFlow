using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.EmailService
{
    public interface IEmailService
    {
        Task<AppResponse> SendEmailAsync(string toEmail, EmailTemplates template, params (string token, string replaceWith)[] tokens);
    }
}
