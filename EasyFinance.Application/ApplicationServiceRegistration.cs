using EasyFinance.Application.Features.ProjectService;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application
{
    public static class ApplicationServiceRegistration
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            services.AddScoped<ProjectService>();

            return services;
        }
    }
}
