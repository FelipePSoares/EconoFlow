using EasyFinance.Domain.AccessControl;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Server.Extensions;
using FpsSoftware.Chassis;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Server.Middleware
{
    public static class AuthenticationMiddleware
    {
        public static IServiceCollection AddAuthenticationServices(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
        {
            var tokenSettings = configuration.GetSection("TokenSettings").Get<JwtTokenSettings>() ?? default!;

            tokenSettings.SecretKey = environment.IsDevelopment() ? "TestEnvironmentKeyNotUseInProduction" : Environment.GetEnvironmentVariable("EconoFlow_TOKEN_SECRET_KEY") ?? tokenSettings.SecretKey;
            tokenSettings.Issuer = Environment.GetEnvironmentVariable("EconoFlow_ISSUER") ?? tokenSettings.Issuer;
            tokenSettings.Audience = Environment.GetEnvironmentVariable("EconoFlow_AUDIENCE") ?? tokenSettings.Audience;

            // Application-specific Identity wiring stays in EconoFlow (user type, stores,
            // roles, claims factory, API endpoints are business/domain concerns).
            services.AddAuthorizationBuilder();
            services.AddHttpContextAccessor();

            var identityBuilder = services.AddIdentityCore<User>()
                .AddSignInManager()
                .AddRoles<IdentityRole<Guid>>()
                .AddEntityFrameworkStores<EasyFinanceDatabaseContext>()
                .AddClaimsPrincipalFactory<CustomClaimsPrincipalFactory>()
                .AddTokenProvider<AuthenticatorTokenProvider<User>>(TokenOptions.DefaultAuthenticatorProvider)
                .AddTokenProvider<DataProtectorTokenProvider<User>>("REFRESHTOKENPROVIDER")
                .AddApiEndpoints();

            services.Configure<IdentityOptions>(options =>
            {
                // Password settings.
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Password.RequiredLength = 8;

                // Lockout settings.
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.AllowedForNewUsers = true;

                // Default SignIn settings.
                options.SignIn.RequireConfirmedEmail = false;
                options.User.RequireUniqueEmail = true;
                options.Tokens.AuthenticatorTokenProvider = TokenOptions.DefaultAuthenticatorProvider;
            });

            services.Configure<DataProtectionTokenProviderOptions>(options =>
            {
                options.TokenLifespan = TimeSpan.FromSeconds(tokenSettings.RefreshTokenExpireSeconds);
            });

            // Generic JWT bearer setup comes from the fpssoftware.chassis package.
            services.AddChassisJwtBearer(tokenSettings, accessTokenCookieName: "AuthToken");

            return services;
        }
    }
}
