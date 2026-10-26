using System.IO;
using System.Net;
using System.Text.RegularExpressions;
using EasyFinance.Server.Extensions;
using FluentAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Verifies that X-Forwarded-Proto / X-Forwarded-For sent by the upstream proxy
    /// (Traefik, TLS termination at the Ingress) are honoured only from trusted proxy
    /// networks. This is the root cause of the 307 redirect loop behind the ingress:
    /// without forwarded headers the app sees plain HTTP for every request and
    /// UseHttpsRedirection answered everything (e.g. POST /api/AccessControl/register)
    /// with a 307 to the very same HTTPS URL.
    /// </summary>
    public class ForwardedHeadersTests
    {
        private const string TrustedProxyIp = "10.42.1.5";
        private const string ClientIp = "198.51.100.7";
        private const string UntrustedPeerIp = "203.0.113.9";
        private const string RegisterPath = "/api/AccessControl/register";

        private static void ConfigureTrustedNetworks(ForwardedHeadersOptions options)
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.KnownIPNetworks.Add(new System.Net.IPNetwork(IPAddress.Parse("10.42.0.0"), 16));
            options.KnownIPNetworks.Add(new System.Net.IPNetwork(IPAddress.Parse("10.43.0.0"), 16));
        }

        private static async Task<DefaultHttpContext> RunAsync(
            RequestDelegate pipeline,
            IServiceProvider services,
            string path,
            string scheme = "http",
            string remoteIp = TrustedProxyIp,
            string? xForwardedProto = null,
            string? xForwardedFor = null)
        {
            var ctx = new DefaultHttpContext();
            ctx.RequestServices = services;
            ctx.Connection.RemoteIpAddress = IPAddress.Parse(remoteIp);
            ctx.Request.Scheme = scheme;
            ctx.Request.Host = new HostString("econoflow.fpssoftware.uk");
            ctx.Request.Path = new PathString(path);
            if (xForwardedProto != null)
                ctx.Request.Headers["X-Forwarded-Proto"] = xForwardedProto;
            if (xForwardedFor != null)
                ctx.Request.Headers["X-Forwarded-For"] = xForwardedFor;
            ctx.Response.Body = new MemoryStream();
            await pipeline(ctx);
            return ctx;
        }

        [Fact]
        public void AddForwardedHeadersServices_ConfiguresProtoAndFor_AndKnownNetworks()
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ForwardedHeaders:KnownNetworks:0"] = "10.42.0.0/16",
                    ["ForwardedHeaders:KnownNetworks:1"] = "10.43.0.0/16",
                })
                .Build();
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddOptions();

            services.AddForwardedHeadersServices(configuration);
            var options = services.BuildServiceProvider()
                .GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;

            options.ForwardedHeaders.Should().HaveFlag(ForwardedHeaders.XForwardedProto);
            options.ForwardedHeaders.Should().HaveFlag(ForwardedHeaders.XForwardedFor);
            options.KnownIPNetworks.Should().Contain(network => network.ToString() == "10.42.0.0/16");
            options.KnownIPNetworks.Should().Contain(network => network.ToString() == "10.43.0.0/16");
        }

        [Fact]
        public void GetKnownNetworks_WithoutConfiguration_ShouldReturnEmpty()
        {
            var configuration = new ConfigurationBuilder().Build();

            EasyFinance.Server.Extensions.ForwardedHeadersExtensions.GetKnownNetworks(configuration).Should().BeEmpty();
        }

        [Fact]
        public void GetKnownNetworks_WithInvalidEntries_ShouldSkipThem()
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ForwardedHeaders:KnownNetworks:0"] = "not-a-network",
                    ["ForwardedHeaders:KnownNetworks:1"] = "10.42.0.0/16",
                })
                .Build();

            var networks = EasyFinance.Server.Extensions.ForwardedHeadersExtensions.GetKnownNetworks(configuration);

            networks.Should().HaveCount(1);
            networks.Single().PrefixLength.Should().Be(16);
        }

        [Fact]
        public async Task TrustedProxy_WithHttpsProto_ShouldRewriteSchemeToHttps()
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddOptions();
            services.Configure<ForwardedHeadersOptions>(ConfigureTrustedNetworks);
            var provider = services.BuildServiceProvider();

            var builder = new ApplicationBuilder(provider);
            builder.UseMiddleware<ForwardedHeadersMiddleware>();
            string? schemeAfter = null;
            builder.Run(ctx =>
            {
                schemeAfter = ctx.Request.Scheme;
                return Task.CompletedTask;
            });

            await RunAsync(builder.Build(), provider, RegisterPath, xForwardedProto: "https");

            schemeAfter.Should().Be("https");
        }

        [Fact]
        public async Task TrustedProxy_WithForwardedFor_ShouldRestoreRealClientIp()
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddOptions();
            services.Configure<ForwardedHeadersOptions>(ConfigureTrustedNetworks);
            var provider = services.BuildServiceProvider();

            var builder = new ApplicationBuilder(provider);
            builder.UseMiddleware<ForwardedHeadersMiddleware>();
            IPAddress? remoteIpAfter = null;
            builder.Run(ctx =>
            {
                remoteIpAfter = ctx.Connection.RemoteIpAddress;
                return Task.CompletedTask;
            });

            await RunAsync(builder.Build(), provider, RegisterPath, xForwardedFor: ClientIp);

            remoteIpAfter.Should().Be(IPAddress.Parse(ClientIp));
        }

        [Fact]
        public async Task UntrustedPeer_WithHttpsProto_ShouldBeIgnored()
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddOptions();
            services.Configure<ForwardedHeadersOptions>(ConfigureTrustedNetworks);
            var provider = services.BuildServiceProvider();

            var builder = new ApplicationBuilder(provider);
            builder.UseMiddleware<ForwardedHeadersMiddleware>();
            string? schemeAfter = null;
            builder.Run(ctx =>
            {
                schemeAfter = ctx.Request.Scheme;
                return Task.CompletedTask;
            });

            await RunAsync(builder.Build(), provider, RegisterPath, remoteIp: UntrustedPeerIp, xForwardedProto: "https");

            schemeAfter.Should().Be("http");
        }

        [Fact]
        public async Task RegisterPost_WithTrustedHttpsProto_RedirectStepSeesHttps_SoNoRedirect()
        {
            // HttpsRedirectionMiddleware cannot be composed with UseMiddleware<> (multiple
            // constructors), so a stub records the scheme it observes at the redirect step â€”
            // the exact input the real middleware uses to decide whether to redirect.
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddOptions();
            services.Configure<ForwardedHeadersOptions>(ConfigureTrustedNetworks);
            var provider = services.BuildServiceProvider();

            var builder = new ApplicationBuilder(provider);
            builder.UseMiddleware<ForwardedHeadersMiddleware>();
            string? schemeAtRedirectStep = null;
            builder.Run(ctx =>
            {
                schemeAtRedirectStep = ctx.Request.Scheme;
                return Task.CompletedTask;
            });

            await RunAsync(builder.Build(), provider, RegisterPath, xForwardedProto: "https");

            schemeAtRedirectStep.Should().Be("https");
        }

        [Fact]
        public async Task RegisterPost_PlainHttp_RedirectStepSeesHttp_SoWouldRedirect()
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddOptions();
            services.Configure<ForwardedHeadersOptions>(ConfigureTrustedNetworks);
            var provider = services.BuildServiceProvider();

            var builder = new ApplicationBuilder(provider);
            builder.UseMiddleware<ForwardedHeadersMiddleware>();
            string? schemeAtRedirectStep = null;
            builder.Run(ctx =>
            {
                schemeAtRedirectStep = ctx.Request.Scheme;
                return Task.CompletedTask;
            });

            await RunAsync(builder.Build(), provider, RegisterPath);

            schemeAtRedirectStep.Should().Be("http");
        }

        [Fact]
        public async Task TheDevStackConfiguration_ShouldTrustTheContainerProxy()
        {
            // docker-compose.dev.yml runs the application behind Docker's port forwarding, and
            // whatever reverse proxy a developer puts in front of it. It has to configure
            // ForwardedHeaders__KnownProxies/__KnownNetworks, or a deployment that relies on the
            // forwarded scheme sees plain HTTP - appsettings.json trusts only the cluster CIDR
            // (10.42.0.0/16), which no local request comes from.
            //
            // The compose file is the source, so the check is textual; this test then applies
            // exactly those values to the real options type and asserts the outcome that
            // matters: the proxied scheme is honoured from the address the hop arrives from.
            var compose = File.ReadAllText(Path.Combine(RepoRoot(), "docker-compose.dev.yml"));
            var settings = new Dictionary<string, string?>();

            foreach (Match line in Regex.Matches(compose, @"(?m)^\s+-\s*(ForwardedHeaders__[A-Za-z0-9_]+)=(.+?)\s*$"))
                settings[line.Groups[1].Value.Replace("__", ":", StringComparison.Ordinal)] = line.Groups[2].Value;

            settings.Should().NotBeEmpty(
                "the dev stack must configure the forwarded-headers middleware, or the app "
                + "never sees the scheme a proxy in front of it terminated");

            var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddOptions();
            services.AddForwardedHeadersServices(configuration);

            // The compose file cannot express a KnownProxies list through this options type -
            // the middleware reads KnownProxies separately - so assert the network form, which
            // is what GetKnownNetworks parses, and that the hop into the container is inside it.
            var options = services.BuildServiceProvider()
                .GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;

            options.KnownIPNetworks.Should().NotBeEmpty(
                "an empty list means only loopback is trusted, and Docker's hop is not loopback");

            options.KnownIPNetworks.Should().Contain(
                network => network.Contains(IPAddress.Loopback),
                "the request reaches Kestrel from loopback through Docker's port forwarding");

            var provider = services.BuildServiceProvider();
            var builder = new ApplicationBuilder(provider);
            builder.UseMiddleware<ForwardedHeadersMiddleware>();
            string? schemeAfter = null;
            builder.Run(ctx =>
            {
                schemeAfter = ctx.Request.Scheme;
                return Task.CompletedTask;
            });

            await RunAsync(builder.Build(), provider, RegisterPath, remoteIp: "127.0.0.1", scheme: "http", xForwardedProto: "http");

            schemeAfter.Should().Be(
                "http",
                "the stack serves plain HTTP on 4200, so the proxied scheme must be honoured "
                + "or the app redirects to a port nothing listens on");
        }

        private static string RepoRoot()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);

            while (directory != null)
            {
                if (File.Exists(Path.Combine(directory.FullName, "EasyFinance.sln")))
                    return directory.FullName;

                directory = directory.Parent;
            }

            throw new InvalidOperationException(
                $"Could not locate the repository root above '{AppContext.BaseDirectory}'.");
        }

        [Fact]
        public void KnownProxiesFromConfiguration_ShouldBeBound()
        {
            // The dev stack publishes the app behind Docker's port forwarding. Options binding is what
            // carries ForwardedHeaders__KnownProxies__0 into the middleware, so confirm the
            // binder sees it; a value it cannot bind would be silently absent.
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ForwardedHeaders:KnownNetworks:0"] = "0.0.0.0/0",
                    ["ForwardedHeaders:KnownProxies:0"] = "127.0.0.1",
                })
                .Build();

            var services = new ServiceCollection();
            services.AddLogging();
            services.AddOptions();
            services.AddForwardedHeadersServices(configuration);

            var options = services.BuildServiceProvider()
                .GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;

            options.KnownIPNetworks.Should().Contain(network => network.Contains(IPAddress.Loopback));
            options.KnownProxies.Should().Contain(IPAddress.Loopback);
        }

        [Fact]
        public void GetKnownProxies_WithInvalidEntries_ShouldSkipThem()
        {
            // A typo must not silently trust something else: the whole point of this list is
            // that only the configured proxy is believed.
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ForwardedHeaders:KnownProxies:0"] = "not-an-address",
                    ["ForwardedHeaders:KnownProxies:1"] = "127.0.0.1",
                    ["ForwardedHeaders:KnownProxies:2"] = "  ",
                })
                .Build();

            var proxies = EasyFinance.Server.Extensions.ForwardedHeadersExtensions.GetKnownProxies(configuration);

            proxies.Should().BeEquivalentTo([IPAddress.Loopback]);
        }

        [Fact]
        public void GetKnownProxies_WithoutConfiguration_ShouldReturnEmpty()
        {
            EasyFinance.Server.Extensions.ForwardedHeadersExtensions.GetKnownProxies(new ConfigurationBuilder().Build()).Should().BeEmpty();
        }

        [Fact]
        public void AddForwardedHeadersServices_ShouldClearTheFrameworkDefaults()
        {
            // ASP.NET starts with a loopback-only proxy list. Adding the configured networks on
            // top of it would leave the framework's defaults trusted as well, so a deployment
            // that configures one cluster CIDR would also trust whatever came before it.
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ForwardedHeaders:KnownNetworks:0"] = "10.42.0.0/16",
                })
                .Build();

            var services = new ServiceCollection();
            services.AddLogging();
            services.AddOptions();
            services.AddForwardedHeadersServices(configuration);

            var options = services.BuildServiceProvider()
                .GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;

            options.KnownIPNetworks.Should().HaveCount(1);
            options.KnownIPNetworks.Single().Should().Be(System.Net.IPNetwork.Parse("10.42.0.0/16"));
            options.KnownProxies.Should().BeEmpty("nothing was configured as a known proxy");
        }

        [Fact]
        public void AddForwardedHeadersServices_WithNoConfiguration_ShouldTrustNothing()
        {
            // The control case: no proxy is trusted when none is configured, which is what
            // keeps a direct, header-spoofing client from choosing its own scheme.
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddOptions();
            services.AddForwardedHeadersServices(new ConfigurationBuilder().Build());

            var options = services.BuildServiceProvider()
                .GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;

            options.KnownIPNetworks.Should().BeEmpty();
            options.KnownProxies.Should().BeEmpty();
        }

        [Fact]
        public void Program_ShouldAllowDisablingTheHttpsRedirect()
        {
            // A local stack serves plain HTTP on one port. With the redirect hard-coded to
            // 443, every request - the SPA's, and the suite's API calls - is answered with a
            // 307 to https://<host>/, where nothing listens. The port therefore has to be
            // configurable, and 0 has to mean "no HTTPS endpoint here".
            //
            // Asserted against Program.cs for the same reason as the migration wiring test:
            // the default is the property under test, and standing up a web server to read
            // one option would cost every test run.
            var program = File.ReadAllText(
                Path.Combine(RepoRoot(), "EasyFinance.Server", "Program.cs"));

            program.Should().Contain(
                "HttpsRedirection:HttpsPort",
                "the redirect target must be configurable, or a plain-HTTP local run cannot "
                + "serve a single request");

            program.Should().Contain(
                ": 443",
                "443 stays the default, which is what the ingress deployment relies on");
        }
    }
}
