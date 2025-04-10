using System.Net;
using System.Security.Claims;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;

namespace EasyFinance.Server.MiddleWare
{
    public class ProjectAuthorizationMiddleware
    {
        private readonly RequestDelegate next;

        public ProjectAuthorizationMiddleware(RequestDelegate next)
        {
            this.next = next;
        }

        public async Task InvokeAsync(HttpContext httpContext, IAccessControlService accessControlService, IProjectService projectService)
        {
            if (httpContext?.Request?.RouteValues != null && httpContext.Request.RouteValues.TryGetValue("projectId", out var projectIdValue))
            {
                if (httpContext.User == null)
                {
                    httpContext.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                    return;
                }

                if (!Guid.TryParse(httpContext.User.Claims.FirstOrDefault(claim => claim.Type == ClaimTypes.NameIdentifier)?.Value, out var userId))
                {
                    httpContext.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                    return;
                }

                if (!Guid.TryParse(projectIdValue.ToString(), out var projectId))
                {
                    httpContext.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                    return;
                }

                if (httpContext.Request.Path.HasValue && httpContext.Request.Path.Value.Contains("/company", StringComparison.InvariantCultureIgnoreCase))
                {
                    var project = projectService.GetById(userId, projectId);

                    if (project.Failed || project.Data.Project.Type != ProjectTypes.Company)
                    {
                        httpContext.Response.StatusCode = (int)HttpStatusCode.Forbidden;
                        return;
                    }
                }
                
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
