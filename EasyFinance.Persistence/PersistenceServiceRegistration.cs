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
            services.AddDbContext<EasyFinanceDatabaseContext>(
                options => options.UseInMemoryDatabase("AppDb"));
#else
            services.AddDbContext<EasyFinanceDatabaseContext>(
                options => options.UseSqlServer(Environment.GetEnvironmentVariable("EasyFinanceDB")));

            services.AddHealthChecks()
                .AddSqlServer(Environment.GetEnvironmentVariable("EasyFinanceDB"));
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
            }

            return app;
        }
    }
}
