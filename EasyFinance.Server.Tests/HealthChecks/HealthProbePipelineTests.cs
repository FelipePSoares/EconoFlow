using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Server.HealthChecks;
using FluentAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace EasyFinance.Server.Tests.HealthChecks
{
    /// <summary>
    /// Verifies that the Kubernetes health probes (/api/health/live, /api/health/ready)
    /// are answered with a real health result over plain HTTP — never a 307 HTTPS
    /// redirect. TLS is terminated upstream, so the probes arrive over HTTP; the global
    /// HTTPS-redirect middleware used to answer them with 307 to a non-listening HTTPS
    /// port, which kept the container permanently un-Ready.
    /// </summary>
    public class HealthProbePipelineTests
    {
        private const string HealthLivePath = "/api/health/live";
        private const string HealthReadyPath = "/api/health/ready";
        private const string NormalPath = "/api/values";

        private static (RequestDelegate Pipeline, IServiceProvider Services) BuildPipeline(HealthStatus readyStatus)
        {
            var services = new ServiceCollection();
            services.AddOptions();
            services.AddLogging();
            services.AddRouting();
            services.AddSingleton<HealthCheckService>(sp => new StubHealthCheckService(readyStatus));
            var provider = services.BuildServiceProvider();

            var builder = new ApplicationBuilder(provider);

            // Mirror the branch wired into Program.cs: health probes over plain HTTP are
            // run to completion here, so the HTTPS-redirect middleware is never reached.
            builder.MapWhen(
                ctx => HealthCheckPathPolicy.IsHealthProbePath(ctx.Request.Path)
                       && !IsHttps(ctx),
                healthProbe => healthProbe.Run(
                    ctx => HealthProbeResponseWriter.WriteHealthProbeAsync(ctx)));

            // Everything else flows to the (empty, in this unit) rest of the main pipeline.
            return (builder.Build(), provider);
        }

        private static bool IsHttps(HttpContext ctx) =>
            string.Equals(ctx.Request.Scheme, "https", StringComparison.OrdinalIgnoreCase);

        private static async Task<DefaultHttpContext> RunAsync(RequestDelegate pipeline, IServiceProvider services, string path, bool isHttps)
        {
            var ctx = new DefaultHttpContext();
            ctx.RequestServices = services;
            ctx.Request.Scheme = isHttps ? "https" : "http";
            ctx.Request.Host = new HostString("localhost");
            ctx.Request.Path = new PathString(path);
            ctx.Response.Body = new MemoryStream();
            await pipeline(ctx);
            return ctx;
        }

        [Fact]
        public async Task HealthLive_OverPlainHttp_ShouldReturn200_NotRedirect()
        {
            var (pipeline, services) = BuildPipeline(HealthStatus.Healthy);

            var ctx = await RunAsync(pipeline, services, HealthLivePath, isHttps: false);

            ctx.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
        }

        [Fact]
        public async Task HealthReady_OverPlainHttp_WhenHealthy_ShouldReturn200()
        {
            var (pipeline, services) = BuildPipeline(HealthStatus.Healthy);

            var ctx = await RunAsync(pipeline, services, HealthReadyPath, isHttps: false);

            ctx.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
        }

        [Fact]
        public async Task HealthReady_OverPlainHttp_WhenUnhealthy_ShouldReturn503_NotRedirect()
        {
            var (pipeline, services) = BuildPipeline(HealthStatus.Unhealthy);

            var ctx = await RunAsync(pipeline, services, HealthReadyPath, isHttps: false);

            ctx.Response.StatusCode.Should().Be(StatusCodes.Status503ServiceUnavailable);
        }

        [Fact]
        public async Task HealthLive_OverHttps_IsNotSwallowedByHealthBranch()
        {
            // Over HTTPS the probe is left to the main pipeline's existing MapHealthChecks
            // (not the plain-HTTP bypass branch), so it must reach the main pipeline here.
            bool reachedMainPipeline = false;
            var services = new ServiceCollection();
            services.AddOptions();
            services.AddLogging();
            services.AddRouting();
            services.AddSingleton<HealthCheckService>(sp => new StubHealthCheckService(HealthStatus.Healthy));
            var provider = services.BuildServiceProvider();
            var builder = new ApplicationBuilder(provider);
            builder.MapWhen(
                ctx => HealthCheckPathPolicy.IsHealthProbePath(ctx.Request.Path) && !IsHttps(ctx),
                healthProbe => healthProbe.Run(ctx => HealthProbeResponseWriter.WriteHealthProbeAsync(ctx)));
            builder.Run(_ => { reachedMainPipeline = true; return Task.CompletedTask; });

            var ctx = await RunAsync(builder.Build(), provider, HealthLivePath, isHttps: true);

            reachedMainPipeline.Should().BeTrue();
        }

        [Fact]
        public async Task NonHealth_OverPlainHttp_IsNotSwallowedByHealthBranch()
        {
            bool reachedMainPipeline = false;
            var services = new ServiceCollection();
            services.AddOptions();
            services.AddLogging();
            services.AddRouting();
            services.AddSingleton<HealthCheckService>(sp => new StubHealthCheckService(HealthStatus.Healthy));
            var provider = services.BuildServiceProvider();
            var builder = new ApplicationBuilder(provider);
            builder.MapWhen(
                ctx => HealthCheckPathPolicy.IsHealthProbePath(ctx.Request.Path) && !IsHttps(ctx),
                healthProbe => healthProbe.Run(ctx => HealthProbeResponseWriter.WriteHealthProbeAsync(ctx)));
            builder.Run(_ => { reachedMainPipeline = true; return Task.CompletedTask; });

            var ctx = await RunAsync(builder.Build(), provider, NormalPath, isHttps: false);

            reachedMainPipeline.Should().BeTrue();
        }

        [Fact]
        public void IsHealthProbePath_HealthPaths_ShouldReturnTrue()
        {
            HealthCheckPathPolicy.IsHealthProbePath(new PathString(HealthLivePath)).Should().BeTrue();
            HealthCheckPathPolicy.IsHealthProbePath(new PathString(HealthReadyPath)).Should().BeTrue();
        }

        [Fact]
        public void IsHealthProbePath_NonHealthPaths_ShouldReturnFalse()
        {
            HealthCheckPathPolicy.IsHealthProbePath(new PathString(NormalPath)).Should().BeFalse();
            HealthCheckPathPolicy.IsHealthProbePath(new PathString()).Should().BeFalse();
            HealthCheckPathPolicy.IsHealthProbePath(new PathString("/api/health/fubar")).Should().BeFalse();
        }

        [Fact]
        public void IsLive_OnlyMatchesLivenessPath()
        {
            HealthCheckPathPolicy.IsLive(new PathString(HealthLivePath)).Should().BeTrue();
            HealthCheckPathPolicy.IsLive(new PathString(HealthReadyPath)).Should().BeFalse();
            HealthCheckPathPolicy.IsLive(new PathString(NormalPath)).Should().BeFalse();
        }

        private class StubHealthCheckService : HealthCheckService
        {
            private readonly HealthStatus status;
            public StubHealthCheckService(HealthStatus status) => this.status = status;

            public override Task<HealthReport> CheckHealthAsync(
                Func<HealthCheckRegistration, bool>? predicate,
                CancellationToken cancellationToken = default)
            {
                var entry = new HealthReportEntry(
                    this.status,
                    description: null,
                    duration: TimeSpan.Zero,
                    exception: null,
                    new Dictionary<string, object>());
                var entries = new Dictionary<string, HealthReportEntry>
                {
                    ["stub"] = entry,
                };
                var report = new HealthReport(entries, this.status, TimeSpan.Zero);
                return Task.FromResult(report);
            }
        }
    }
}
