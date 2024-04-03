using System.Net;
using System.Security.Claims;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Server.MiddleWare
{
    public class ProjectAuthorizationMiddleware
    {
        private readonly RequestDelegate next;

        public ProjectAuthorizationMiddleware(RequestDelegate next)
        {
            this.next = next;
        }

        public async Task InvokeAsync(HttpContext httpContext, IAccessControlService accessControlService)
        {
            if (httpContext.Request.RouteValues.TryGetValue("projectId", out var projectIdValue))
            {
                var userId = new Guid(httpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);
                var projectId = new Guid(projectIdValue.ToString());
                var accessNeeded = httpContext.Request.Method == "GET" ? Role.Viewer : Role.Manager;

                var hasAuthorization = accessControlService.HasAuthorization(userId, projectId, accessNeeded);

                if (!hasAuthorization)
                {
                    httpContext.Response.StatusCode = (int)HttpStatusCode.Forbidden;
                    return;
                }
            }

            await next(httpContext);
        }
    }

    public static class AuthorizationMiddlewareExtensions
    {
        public static IApplicationBuilder UseProjectAuthorization(
            this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<ProjectAuthorizationMiddleware>();
        }
    }
}
