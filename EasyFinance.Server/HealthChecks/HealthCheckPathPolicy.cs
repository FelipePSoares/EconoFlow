using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace EasyFinance.Server.HealthChecks
{
    /// <summary>
    /// Centralises the set of paths that Kubernetes probes hit (/api/health/live,
    /// /api/health/ready). These probes run over plain HTTP inside the container
    /// (TLS is terminated upstream), so the HTTPS-redirect middleware must not divert
    /// them; otherwise the probes receive a 307 and the container never becomes Ready.
    /// </summary>
    public static class HealthCheckPathPolicy
    {
        public const string LivePath = "/api/health/live";
        public const string ReadyPath = "/api/health/ready";

        /// <summary>
        /// Liveness reports whether the process can serve requests — no dependency checks.
        /// </summary>
        public static readonly Func<HealthCheckRegistration, bool> LivenessPredicate = _ => false;

        /// <summary>
        /// Readiness requires every registered dependency check (SQL Server, S3/Minio) to pass.
        /// </summary>
        public static readonly Func<HealthCheckRegistration, bool> ReadinessPredicate = _ => true;

        /// <summary>
        /// Returns true when the given path is one of the health-probe endpoints.
        /// </summary>
        public static bool IsHealthProbePath(PathString path)
        {
            if (path.HasValue && path.Value is string value)
            {
                return string.Equals(value, LivePath, System.StringComparison.OrdinalIgnoreCase)
                    || string.Equals(value, ReadyPath, System.StringComparison.OrdinalIgnoreCase);
            }

            return false;
        }

        /// <summary>
        /// Returns true when the given path is the liveness probe endpoint.
        /// </summary>
        public static bool IsLive(PathString path)
        {
            return path.HasValue
                && string.Equals(path.Value, LivePath, System.StringComparison.OrdinalIgnoreCase);
        }
    }
}
