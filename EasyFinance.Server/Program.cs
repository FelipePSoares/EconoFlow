using System.Net;
using EasyFinance.Application;
using EasyFinance.Application.BackgroundServices.AttachmentCleanup;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Features.ExpoPushTokenService;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Application.Features.TurnstileService;
using EasyFinance.Application.Features.WebPushService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Server.Config;
using EasyFinance.Server.Extensions;
using EasyFinance.Server.HealthChecks;
using EasyFinance.Server.Middleware;
using EasyFinance.Server.MiddleWare;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc.Authorization;
using Newtonsoft.Json.Converters;
using Serilog;
using Smtp2Go.Api;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();
builder.Services.AddPersistenceServices(builder.Configuration);
builder.Services.AddApplicationServices();

// Register the S3/Minio health check (readiness probe dependency).
builder.Services.AddHealthChecks()
    .AddCheck<S3StorageHealthCheck>("s3_storage", tags: new[] { "storage", "s3" });

builder.Services.Configure<NotifierFallbackOptions>(builder.Configuration.GetSection(NotifierFallbackOptions.SectionName));
builder.Services.Configure<WebPushOptions>(builder.Configuration.GetSection(WebPushOptions.SectionName));
var expoPushSettings = builder.Configuration.GetSection(ExpoPushOptions.SectionName).Get<ExpoPushOptions>() ?? new ExpoPushOptions();
expoPushSettings.AccessToken = Environment.GetEnvironmentVariable("EconoFlow_EXPO_PUSH_ACCESS_TOKEN") ?? expoPushSettings.AccessToken;
builder.Services.Configure<ExpoPushOptions>(options =>
{
    options.AccessToken = expoPushSettings.AccessToken;
});
builder.Services.Configure<FeatureRolloutOptions>(builder.Configuration.GetSection(FeatureRolloutOptions.SectionName));
builder.Services.Configure<TemporaryAttachmentCleanupOptions>(builder.Configuration.GetSection(TemporaryAttachmentCleanupOptions.SectionName));

var attachmentStorageSettings = builder.Configuration.GetSection(AttachmentStorageOptions.SectionName).Get<AttachmentStorageOptions>() ?? new AttachmentStorageOptions();
attachmentStorageSettings.Endpoint = Environment.GetEnvironmentVariable("S3_ENDPOINT") ?? attachmentStorageSettings.Endpoint;
attachmentStorageSettings.AccessKey = Environment.GetEnvironmentVariable("S3_ACCESS_KEY") ?? attachmentStorageSettings.AccessKey;
attachmentStorageSettings.SecretKey = Environment.GetEnvironmentVariable("S3_SECRET_KEY") ?? attachmentStorageSettings.SecretKey;
attachmentStorageSettings.Bucket = Environment.GetEnvironmentVariable("S3_BUCKET") ?? attachmentStorageSettings.Bucket;
builder.Services.Configure<AttachmentStorageOptions>(options =>
{
    options.Provider = attachmentStorageSettings.Provider;
    options.LocalRootPath = attachmentStorageSettings.LocalRootPath;
    options.Endpoint = attachmentStorageSettings.Endpoint;
    options.AccessKey = attachmentStorageSettings.AccessKey;
    options.SecretKey = attachmentStorageSettings.SecretKey;
    options.Bucket = attachmentStorageSettings.Bucket;
    options.UseSsl = attachmentStorageSettings.UseSsl;
    options.Region = attachmentStorageSettings.Region;
});
builder.Services.Configure<AttachmentMigrationOptions>(builder.Configuration.GetSection(AttachmentMigrationOptions.SectionName));

var turnstileSettings = builder.Configuration.GetSection(TurnstileSettings.SectionName).Get<TurnstileSettings>() ?? new TurnstileSettings();
turnstileSettings.SecretKey = Environment.GetEnvironmentVariable("EconoFlow_TURNSTILE_SECRET_KEY") ?? turnstileSettings.SecretKey;
turnstileSettings.SiteKey = Environment.GetEnvironmentVariable("EconoFlow_TURNSTILE_SITE_KEY") ?? turnstileSettings.SiteKey;
builder.Services.Configure<TurnstileSettings>(options =>
{
    options.SecretKey = turnstileSettings.SecretKey;
    options.SiteKey = turnstileSettings.SiteKey;
});

builder.Services.AddAuthenticationServices(builder.Configuration, builder.Environment);

if (builder.Environment.IsDevelopment())
    builder.Services.AddTransient<IEmailSender, DevEmailSender>();
else
    builder.Services.AddTransient<IEmailSender, EmailSender>();

// Add services to the container.
builder.Services.AddControllers(config =>
{
    var policy = new AuthorizationPolicyBuilder()
                     .RequireAuthenticatedUser()
                     .Build();
    config.Filters.Add(new AuthorizeFilter(policy));
    config.SuppressAsyncSuffixInActionNames = false;
})
    .AddNewtonsoftJson(setup =>
    {
        setup.SerializerSettings.Converters.Add(new FlagsEnumArrayConverter());
        setup.SerializerSettings.Converters.Add(new StringEnumConverter());
    });

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwagger();

var smtp2GoApiKey = Environment.GetEnvironmentVariable("SMTP2GO_API_KEY");
if (!builder.Environment.IsDevelopment() && string.IsNullOrEmpty(smtp2GoApiKey))
    throw new InvalidOperationException("SMTP2GO_API_KEY environment variable is required");
builder.Services.AddSingleton<IApiService, Smtp2GoApiService>(x
    => new Smtp2GoApiService(smtp2GoApiKey ?? string.Empty));

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

builder.Services.AddHsts(options =>
{
    options.Preload = true;
    options.IncludeSubDomains = true;
    options.MaxAge = TimeSpan.FromDays(365);
});

builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = (int)HttpStatusCode.TemporaryRedirect;
    options.HttpsPort = 443;
});

if (!builder.Environment.IsDevelopment())
{
    var keys = builder.Services.AddDataProtection()
        .PersistKeysToDbContext<MyKeysContext>();

    if (OperatingSystem.IsWindows() && bool.TryParse(Environment.GetEnvironmentVariable("EconoFlow_KEY_ENCRYPT_ACTIVE"), out var result) && result)
        keys.ProtectKeysWithDpapi(false);
}

async Task EnsureSystemRolesAsync(IServiceProvider services)
{
    using var roleScope = services.CreateScope();
    var roleManager = roleScope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

    if (!await roleManager.RoleExistsAsync(SystemRoles.BetaTester))
    {
        var createRoleResult = await roleManager.CreateAsync(new IdentityRole<Guid>(SystemRoles.BetaTester));
        if (!createRoleResult.Succeeded)
        {
            var roleCreationErrors = string.Join(", ", createRoleResult.Errors.Select(error => error.Description));
            throw new InvalidOperationException($"Failed to create required role '{SystemRoles.BetaTester}'. Errors: {roleCreationErrors}");
        }
    }
}

try
{
    var app = builder.Build();
    app.UseSerilogRequestLogging();
    app.UseCustomExceptionHandler();

    app.UseSafeHeaders();

    if (app.Environment.IsDevelopment())
    {
        EnsureSystemRolesAsync(app.Services).GetAwaiter().GetResult();
        app.UseSwagger();
        app.UseSwaggerUI();
        DevelopmentTestDataSeeder.SeedAsync(app.Services).GetAwaiter().GetResult();
    }
    else
    {
        app.UseHsts();
        app.UseSecutiryPolicy();
        app.UseMigration();
        EnsureSystemRolesAsync(app.Services).GetAwaiter().GetResult();
    }

    app.UseDefaultFiles();
    app.UseStaticFiles();

    // Kubernetes health probes reach the container over plain HTTP (TLS is terminated
    // upstream). Answer them with a real health result here so the HTTPS-redirect
    // middleware below cannot divert them to 307 -> a non-listening HTTPS port, which
    // would keep the container permanently un-Ready.
    app.MapWhen(
        ctx => HealthCheckPathPolicy.IsHealthProbePath(ctx.Request.Path)
               && !string.Equals(ctx.Request.Scheme, "https", StringComparison.OrdinalIgnoreCase),
        healthProbeApplication => healthProbeApplication.Run(
            ctx => HealthProbeResponseWriter.WriteHealthProbeAsync(ctx)));

    app.UseHttpsRedirection();

    app.UseAuthentication();
    app.UseCorrelationId();
    app.UseAuthorization();
    app.UseProjectAuthorization();

    app.UseLocationMiddleware();

    // Kubernete probes. Exposed under /api/health/* so the Angular dev-server
    // proxy (src/proxy.conf.js) and ingress rules that forward /api/* can
    // reach them.
    // liveness: the process is up and can respond to HTTP requests.
    // Predicate = _ => false means no dependency checks run; it returns Healthy
    // whenever the process can serve requests.
    app.MapHealthChecks(HealthCheckPathPolicy.LivePath, new HealthCheckOptions
    {
        Predicate = HealthCheckPathPolicy.LivenessPredicate,
    });

    // readiness: the application is ready to serve traffic only when all
    // its dependency checks (SQL Server, S3/Minio storage) pass.
    app.MapHealthChecks(HealthCheckPathPolicy.ReadyPath);

    app.MapControllers();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "The application fail during the start.");
}
finally
{
    Log.CloseAndFlush(); // Close and send all pendent logs to betterstack
}
