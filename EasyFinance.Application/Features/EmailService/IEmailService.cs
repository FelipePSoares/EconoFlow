using System;
using System.Globalization;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.EmailService
{
    public interface IEmailService
    {
        Task<AppResponse> SendEmailAsync(Guid userId, string toEmail, EmailTemplates template, CultureInfo cultureInfo, params (string token, string replaceWith)[] tokens);
        Task<AppResponse> SendEmailAsync(string toEmail, EmailTemplates template, CultureInfo cultureInfo, params (string token, string replaceWith)[] tokens);
    }
}
