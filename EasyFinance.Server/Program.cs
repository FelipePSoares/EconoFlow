using System.Net;
using EasyFinance.Application;
using EasyFinance.Application.BackgroundServices.AttachmentCleanup;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Application.Features.TurnstileService;
using EasyFinance.Application.Features.WebPushService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Server.Config;
using EasyFinance.Server.Extensions;
using EasyFinance.Server.Middleware;
using EasyFinance.Server.MiddleWare;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
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
builder.Services.Configure<NotifierFallbackOptions>(builder.Configuration.GetSection(NotifierFallbackOptions.SectionName));
builder.Services.Configure<WebPushOptions>(builder.Configuration.GetSection(WebPushOptions.SectionName));
builder.Services.Configure<FeatureRolloutOptions>(builder.Configuration.GetSection(FeatureRolloutOptions.SectionName));
builder.Services.Configure<TemporaryAttachmentCleanupOptions>(builder.Configuration.GetSection(TemporaryAttachmentCleanupOptions.SectionName));

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

builder.Services.AddSingleton<IApiService, Smtp2GoApiService>(x 
    => new Smtp2GoApiService(Environment.GetEnvironmentVariable("SMTP2GO_API_KEY") ?? "api-ADEE6A33004F4B178E20CEB4096CA4EA"));

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

    if (bool.TryParse(Environment.GetEnvironmentVariable("EconoFlow_KEY_ENCRYPT_ACTIVE"), out var result) && result)
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

    app.UseHttpsRedirection();

    app.UseAuthentication();
    app.UseCorrelationId();
    app.UseAuthorization();
    app.UseProjectAuthorization();

    app.UseLocationMiddleware();

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
