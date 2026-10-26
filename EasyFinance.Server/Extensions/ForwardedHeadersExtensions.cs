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
        ///
        /// <para>
        /// The defaults are cleared before the configured networks are added. ASP.NET starts
        /// from a loopback-only list, and <c>PostConfigure</c> narrows the lists further;
        /// adding to the default would leave whatever the framework trusts in place next to
        /// the configured proxies, so what is trusted here is exactly what was configured.
        /// </para>
        /// </summary>
        public static IServiceCollection AddForwardedHeadersServices(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                options.KnownIPNetworks.Clear();
                options.KnownProxies.Clear();

                foreach (var network in GetKnownNetworks(configuration))
                    options.KnownIPNetworks.Add(network);

                foreach (var proxy in GetKnownProxies(configuration))
                    options.KnownProxies.Add(proxy);
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

        /// <summary>
        /// Reads ForwardedHeaders:KnownProxies (one address per item, e.g. "127.0.0.1") from
        /// configuration. Invalid entries are skipped.
        ///
        /// <para>
        /// Read here rather than through options binding: the middleware's post-configure step
        /// replaces the proxy lists with its own defaults unless it can see what was
        /// configured, so a value that only exists in configuration is never trusted. Every
        /// deployment behind a reverse proxy needs one of the two forms, and the single-host
        /// form is the one a container stack can express.
        /// </para>
        /// </summary>
        public static IReadOnlyList<System.Net.IPAddress> GetKnownProxies(IConfiguration configuration)
        {
            var proxies = new List<System.Net.IPAddress>();
            var section = configuration.GetSection("ForwardedHeaders:KnownProxies");

            foreach (var child in section.GetChildren())
            {
                var value = child.Value;
                if (string.IsNullOrWhiteSpace(value))
                    continue;

                if (System.Net.IPAddress.TryParse(value, out var address))
                    proxies.Add(address);
            }

            return proxies;
        }
    }
}
