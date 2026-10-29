using System;
using System.Threading.Channels;
using EasyFinance.Application.BackgroundServices.AttachmentCleanup;
using EasyFinance.Application.BackgroundServices.EmailBackgroundService;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.DTOs.BackgroundService.Notification;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Features.CallbackService;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Application.Features.EmailService;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.ExpoPushTokenService;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.NotificationMessageResolver;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Application.Features.PlanService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Application.Features.SupportService;
using EasyFinance.Application.Features.TaxYearService;
using EasyFinance.Application.Features.TurnstileService;
using EasyFinance.Application.Features.UserKeyService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Application.Features.WebPushService;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application
{
    public static class ApplicationServiceRegistration
    {
        /// <summary>
        /// Registers the application services.
        /// </summary>
        /// <param name="services">The service collection.</param>
        /// <param name="userKeySalt">
        /// The salt hashed into every user encryption key. It is resolved and validated once
        /// at start-up (see <c>RequiredSecrets</c> on the server) because this assembly cannot
        /// know whether the host is running in Development: an unconfigured deployment must
        /// not fall back to a published literal. There is deliberately no default here.
        /// </param>
        /// <exception cref="ArgumentNullException">Thrown when no salt is supplied.</exception>
        public static IServiceCollection AddApplicationServices(this IServiceCollection services, string userKeySalt)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(userKeySalt);

            services.AddSingleton<ICallbackService, CallbackService>();

            services.AddScoped<IProjectService, ProjectService>();
            services.AddScoped<IPlanService, PlanService>();
            services.AddScoped<IAccessControlService, AccessControlService>();
            services.AddScoped<IIncomeService, IncomeService>();
            services.AddScoped<ICategoryService, CategoryService>();
            services.AddScoped<IExpenseService, ExpenseService>();
            services.AddScoped<IExpenseItemService, ExpenseItemService>();
            services.AddScoped<ITaxYearService, TaxYearService>();
            services.AddScoped<IAttachmentService, AttachmentService>();
            services.AddOptions<AttachmentStorageOptions>();
            services.AddSingleton<IMinioS3Client>(provider =>
            {
                var settings = provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<AttachmentStorageOptions>>().Value;
                var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger<MinioS3ClientAdapter>();
                return MinioClientFactory.CreateS3Client(settings, logger);
            });
            services.AddSingleton<IAttachmentStorageService>(provider =>
            {
                var options = provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<AttachmentStorageOptions>>();

                IMinioS3Client minioClientFactory() => provider.GetRequiredService<IMinioS3Client>();

                return AttachmentStorageServiceFactory.Create(options, minioClientFactory);
            });
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<IFeatureRolloutService, FeatureRolloutService>();
            services.AddScoped<IContactService, ContactService>();
            services.AddScoped<IEmailService, EmailService>();
            services.AddSingleton<ISmtpClientFactory, MailKitSmtpClientFactory>();
            services.AddSingleton<ISmtpEmailSender, SmtpEmailSender>();
            services.AddScoped<INotificationService, NotificationService>();
            services.AddSingleton<INotificationMessageResolver, NotificationMessageResolver>();
            services.AddScoped<IWebPushService, WebPushService>();
            services.AddScoped<IExpoPushTokenService, ExpoPushTokenService>();
            services.AddScoped<IUserKeyService>(provider => new UserKeyService(userKeySalt));

            // Expo Push
            services.AddHttpClient<IExpoPushClient, ExpoPushClient>();
            services.AddOptions<ExpoPushOptions>();

            // Turnstile CAPTCHA
            services.AddHttpClient<ITurnstileService, TurnstileService>();
            services.AddOptions<TurnstileSettings>();

            // Support Service
            services.AddTransient<EmailChannel>();
            services.AddTransient<SmsChannel>();
            services.AddTransient<PushChannel>();
            services.AddTransient<WebPushChannel>();
            services.AddTransient<CompoundNotificationChannel>();

            // Background Services
            services.AddHostedService<EmailBackgroundService>();
            services.AddHostedService<NotifierBackgroundService>();
            services.AddOptions<NotifierFallbackOptions>();
            services.AddOptions<WebPushOptions>();
            services.AddOptions<TemporaryAttachmentCleanupOptions>();

            // Register Channels
            var emailChannel = Channel.CreateUnbounded<EmailRequest>();
            services.AddSingleton(emailChannel);

            var notificationChannel = Channel.CreateUnbounded<NotificationRequest>();
            services.AddSingleton(notificationChannel);

            services.AddSingleton<ITemporaryAttachmentCleanupService, TemporaryAttachmentCleanupService>();
            services.AddHostedService(provider => (TemporaryAttachmentCleanupService)provider.GetRequiredService<ITemporaryAttachmentCleanupService>());

            return services;
        }
    }
}
