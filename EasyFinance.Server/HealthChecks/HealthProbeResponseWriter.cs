using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace EasyFinance.Server.HealthChecks
{
    /// <summary>
    /// Answers the Kubernetes health probes (/api/health/live and /api/health/ready)
    /// over plain HTTP, without the HTTPS-redirect middleware getting in the way.
    ///
    /// TLS is terminated upstream, so the probes reach the container over HTTP. The
    /// global <c>UseHttpsRedirection</c> middleware would answer those probes with a
    /// 307 to a non-listening HTTPS port, which keeps the container permanently
    /// un-Ready. Program.cs routes health paths into this writer (via <c>MapWhen</c>)
    /// so they get a real health result instead of a redirect.
    /// </summary>
    public static class HealthProbeResponseWriter
    {
        /// <summary>
        /// Runs the configured health checks for the requested probe path and writes the
        /// standard ASP.NET health response (200 for live, 200/503 for ready depending on
        /// the dependency checks). Returns 503 when the health service cannot be resolved.
        /// Assumes the caller only routes recognised health-probe paths here.
        /// </summary>
        public static async Task WriteHealthProbeAsync(HttpContext context)
        {
            var healthService = context.RequestServices?.GetService<HealthCheckService>();
            if (healthService is null)
            {
                context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                return;
            }

            // /live reports liveness only (no dependency checks); /ready runs all checks.
            var predicate = HealthCheckPathPolicy.IsLive(context.Request.Path)
                ? HealthCheckPathPolicy.LivenessPredicate
                : HealthCheckPathPolicy.ReadinessPredicate;

            var report = await healthService.CheckHealthAsync(predicate, context.RequestAborted);

            context.Response.StatusCode = report.Status == HealthStatus.Unhealthy
                ? StatusCodes.Status503ServiceUnavailable
                : StatusCodes.Status200OK;

            context.Response.ContentType = "application/json";
            await using var writer = new StreamWriter(context.Response.Body);
            await writer.WriteAsync($"{{\"status\":\"{report.Status}\"}}");
        }
    }
}
