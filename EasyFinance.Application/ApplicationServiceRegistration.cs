using System.Threading.Channels;
using EasyFinance.Application.BackgroundServices.EmailBackgroundService;
using EasyFinance.Application.DTOs.Email;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.CallbackService;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Application.Features.EmailService;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Application.Features.SupportService;
using EasyFinance.Application.Features.UserService;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application
{
    public static class ApplicationServiceRegistration
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            services.AddSingleton<ICallbackService, CallbackService>();

            services.AddScoped<IProjectService, ProjectService>();
            services.AddScoped<IAccessControlService, AccessControlService>();
            services.AddScoped<IIncomeService, IncomeService>();
            services.AddScoped<ICategoryService, CategoryService>();
            services.AddScoped<IExpenseService, ExpenseService>();
            services.AddScoped<IExpenseItemService, ExpenseItemService>();
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<IClientService, ClientService>();
            services.AddScoped<IContactService, ContactService>();
            services.AddScoped<IEmailService, EmailService>();

            // Background Services
            services.AddHostedService<EmailBackgroundService>();

            // Register Channels
            var channel = Channel.CreateUnbounded<EmailRequest>();
            services.AddSingleton(channel);

            return services;
        }
    }
}
