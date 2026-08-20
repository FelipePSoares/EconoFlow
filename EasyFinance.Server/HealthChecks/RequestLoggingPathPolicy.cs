using Microsoft.AspNetCore.Http;
using Serilog.Events;

namespace EasyFinance.Server.HealthChecks
{
    /// <summary>
    /// Centralises which request paths are surfaced in the Serilog
    /// request-completion log. Only real API traffic is logged: any path under
    /// <c>/api</c> (plus the <c>PushController</c>'s secondary <c>/push</c> route)
    /// other than the Kubernetes health probes. Everything else — static
    /// downloads, Swagger, the SPA root — adds noise and stays silent.
    /// </summary>
    public static class RequestLoggingPathPolicy
    {
        /// <summary>
        /// Returns the Serilog level at which the request-completion event is
        /// emitted. Non-API paths and the health probes are dropped to
        /// <see cref="LogEventLevel.Verbose"/>, which is below the configured
        /// minimum level, so they are never written. API paths keep Serilog's
        /// default behaviour (Information, or Error for failed requests).
        /// </summary>
        public static LogEventLevel GetLevel(HttpContext httpContext, double elapsedMs, Exception? ex)
        {
            if (ShouldExclude(httpContext.Request.Path))
                return LogEventLevel.Verbose;

            if (ex != null || httpContext.Response.StatusCode > 499)
                return LogEventLevel.Error;

            return LogEventLevel.Information;
        }

        /// <summary>
        /// Returns true for requests that should not appear in the logs: the
        /// health probes and anything that is not API traffic.
        /// </summary>
        public static bool ShouldExclude(PathString path)
        {
            if (!path.HasValue)
                return true;

            var value = path.Value ?? string.Empty;

            // Only real API traffic is of interest; the probes are API-shaped but
            // silent, everything else (root, static assets, Swagger) is excluded.
            // /push is the PushController's secondary non-/api route.
            return HealthCheckPathPolicy.IsHealthProbePath(path)
                || !(IsApiPath(value) || IsPushPath(value));
        }

        private static bool IsApiPath(string value) =>
            value.StartsWith("/api", StringComparison.OrdinalIgnoreCase)
            && (value.Length == 4 || value[4] == '/');

        private static bool IsPushPath(string value) =>
            value.StartsWith("/push", StringComparison.OrdinalIgnoreCase)
            && (value.Length == 5 || value[5] == '/');
    }
}
