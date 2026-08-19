using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Server.Extensions
{
    /// <summary>
    /// Configures ASP.NET Core's Forwarded Headers middleware. External traffic is TLS-
    /// terminated at the Traefik Ingress, so the app only ever sees plain HTTP on the
    /// socket. Honouring X-Forwarded-Proto/X-Forwarded-For (from trusted proxies only)
    /// lets HSTS, UseHttpsRedirection, callback/absolute-URL generation and request
    /// logging see the real scheme and client IP instead of redirecting everything to
    /// https in a loop.
    /// </summary>
    public static class ForwardedHeadersExtensions
    {
        /// <summary>
        /// Registers ForwardedHeadersOptions: honour Proto+For headers and trust the
        /// proxy networks from configuration (ForwardedHeaders:KnownNetworks).
        /// </summary>
        public static IServiceCollection AddForwardedHeadersServices(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                foreach (var network in GetKnownNetworks(configuration))
                    options.KnownIPNetworks.Add(network);
            });

            return services;
        }

        /// <summary>
        /// Reads ForwardedHeaders:KnownNetworks (one CIDR per item, e.g.
        /// "10.42.0.0/16") from configuration. Invalid entries are skipped; the list is
        /// empty when nothing is configured (no proxy is trusted).
        /// </summary>
        public static IReadOnlyList<System.Net.IPNetwork> GetKnownNetworks(IConfiguration configuration)
        {
            var networks = new List<System.Net.IPNetwork>();
            var section = configuration.GetSection("ForwardedHeaders:KnownNetworks");

            foreach (var child in section.GetChildren())
            {
                var value = child.Value;
                if (string.IsNullOrWhiteSpace(value))
                    continue;

                if (System.Net.IPNetwork.TryParse(value, out var network))
                    networks.Add(network);
            }

            return networks;
        }
    }
}
