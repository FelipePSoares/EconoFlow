using System.Text;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.Authentication;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Server.Extensions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

namespace EasyFinance.Server.Middleware
{
    public static class AuthenticationMiddleware
    {
        public static IServiceCollection AddAuthenticationServices(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
        {
            var tokenSettings = configuration.GetSection("TokenSettings").Get<TokenSettings>() ?? default!;

            tokenSettings.SecretKey = environment.IsDevelopment() ? "TestEnvironmentKeyNotUseInProduction" : Environment.GetEnvironmentVariable("EconoFlow_TOKEN_SECRET_KEY") ?? tokenSettings.SecretKey;
            tokenSettings.Issuer = Environment.GetEnvironmentVariable("EconoFlow_ISSUER") ?? tokenSettings.Issuer;
            tokenSettings.Audience = Environment.GetEnvironmentVariable("EconoFlow_AUDIENCE") ?? tokenSettings.Audience;
            services.AddSingleton(tokenSettings);

            services.AddAuthorizationBuilder();
            services.AddHttpContextAccessor();

            services.AddIdentityCore<User>()
                .AddSignInManager()
                .AddRoles<IdentityRole<Guid>>()
                .AddEntityFrameworkStores<EasyFinanceDatabaseContext>()
                .AddClaimsPrincipalFactory<CustomClaimsPrincipalFactory>()
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
            });

            services.Configure<DataProtectionTokenProviderOptions>(options =>
            {
                options.TokenLifespan = TimeSpan.FromSeconds(tokenSettings.RefreshTokenExpireSeconds);
            });

            services
                .AddAuthentication(config =>
                {
                    config.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                    config.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                    config.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
                })
                .AddJwtBearer(config =>
                {
                    config.RequireHttpsMetadata = false;
                    config.SaveToken = false;
                    config.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(tokenSettings.SecretKey)),
                        ValidateIssuer = !string.IsNullOrEmpty(tokenSettings.Issuer),
                        ValidIssuer = tokenSettings.Issuer,
                        ValidateAudience = !string.IsNullOrEmpty(tokenSettings.Audience),
                        ValidAudience = tokenSettings.Audience,
                        ClockSkew = TimeSpan.Zero
                    };
                });

            return services;
        }
    }
}
