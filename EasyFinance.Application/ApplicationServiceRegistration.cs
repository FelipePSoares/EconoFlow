using System;
using System.Threading.Channels;
using EasyFinance.Application.BackgroundServices.EmailBackgroundService;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.DTOs.BackgroundService.Notification;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.CallbackService;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Application.Features.EmailService;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Application.Features.SupportService;
using EasyFinance.Application.Features.UserKeyService;
using EasyFinance.Application.Features.UserService;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application
{
    public static class ApplicationServiceRegistration
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            var userKeySalt = Environment.GetEnvironmentVariable("EconoFlow_USER_KEY_SALT") ?? "Development_Key";

            services.AddSingleton<ICallbackService, CallbackService>();

            services.AddScoped<IProjectService, ProjectService>();
            services.AddScoped<IAccessControlService, AccessControlService>();
            services.AddScoped<IIncomeService, IncomeService>();
            services.AddScoped<ICategoryService, CategoryService>();
            services.AddScoped<IExpenseService, ExpenseService>();
            services.AddScoped<IExpenseItemService, ExpenseItemService>();
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<IContactService, ContactService>();
            services.AddScoped<IEmailService, EmailService>();
            services.AddScoped<INotificationService, NotificationService>();
            services.AddScoped<IUserKeyService>(provider => new UserKeyService(userKeySalt));

            // Support Service
            services.AddTransient<EmailChannel>();
            services.AddTransient<SmsChannel>();
            services.AddTransient<PushChannel>();
            services.AddTransient<CompoundNotificationChannel>();

            // Background Services
            services.AddHostedService<EmailBackgroundService>();
            services.AddHostedService<NotifierBackgroundService>();
            services.AddOptions<NotifierFallbackOptions>();

            // Register Channels
            var emailChannel = Channel.CreateUnbounded<EmailRequest>();
            services.AddSingleton(emailChannel);

            var notificationChannel = Channel.CreateUnbounded<NotificationRequest>();
            services.AddSingleton(notificationChannel);

            return services;
        }
    }
}
