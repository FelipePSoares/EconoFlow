using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application
{
    public static class ApplicationServiceRegistration
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            services.AddScoped<IProjectService, ProjectService>();
            services.AddScoped<IAccessControlService, AccessControlService>();
            services.AddScoped<IIncomeService, IncomeService>();
            services.AddScoped<ICategoryService, CategoryService>();

            return services;
        }
    }
}
