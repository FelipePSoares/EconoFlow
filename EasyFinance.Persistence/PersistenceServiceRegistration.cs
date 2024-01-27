using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Persistence
{
    public static class PersistenceServiceRegistration
    {
        public static IServiceCollection AddPersistenceServices(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddDbContext<EasyFinanceDatabaseContext>(options =>
            {
                //Prepared for SQL Instance
                // options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"));
                options.UseInMemoryDatabase("EasyFinanceDatabase");
            });

            services.AddScoped<IUnitOfWork, UnitOfWork>();

            return services;
        }
    }
}
