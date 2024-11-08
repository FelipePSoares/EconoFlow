using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Persistence.Repositories;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Persistence
{
    public static class PersistenceServiceRegistration
    {
        public static IServiceCollection AddPersistenceServices(this IServiceCollection services, IConfiguration configuration)
        {
#if DEBUG
            services.AddDbContext<EasyFinanceDatabaseContext>(options => options
                .UseInMemoryDatabase("AppDb")
                .EnableSensitiveDataLogging());
#else
            var connectionString = Environment.GetEnvironmentVariable("EasyFinanceDB") ?? string.Empty;

            services.AddDbContext<EasyFinanceDatabaseContext>(
                options => options.UseSqlServer(connectionString));

            services.AddDbContext<MyKeysContext>(
                options => options.UseSqlServer(connectionString));

            services.AddHealthChecks()
                .AddSqlServer(connectionString);
#endif

            services.AddScoped<IUnitOfWork, UnitOfWork>();

            return services;
        }

        public static IApplicationBuilder UseMigration(this IApplicationBuilder app)
        {
            using (var serviceScope = app.ApplicationServices.CreateScope())
            {
                var dbContext = serviceScope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();
                dbContext.Database.Migrate();

                var myKeysDbContext = serviceScope.ServiceProvider.GetRequiredService<MyKeysContext>();
                myKeysDbContext.Database.Migrate();
            }

            return app;
        }
    }
}
