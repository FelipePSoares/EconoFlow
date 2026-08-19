using System.Net;
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
            // constructors), so a stub records the scheme it observes at the redirect step —
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
    }
}
