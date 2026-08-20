using System;
using EasyFinance.Server.HealthChecks;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Serilog.Events;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Verifies which request paths are excluded from the Serilog request-completion
    /// log. Only real /api traffic is logged: health-probe endpoints and every
    /// non-API path (root, static assets, Swagger) are filtered out.
    /// </summary>
    public class RequestLoggingPathPolicyTests
    {
        [Theory]
        [InlineData("/")]
        [InlineData("/favicon.ico")]
        [InlineData("/assets/version.json")]
        [InlineData("/swagger/index.html")]
        [InlineData("")]
        public void GetLevel_NonApiPaths_ShouldReturnVerbose(string path)
        {
            var ctx = new DefaultHttpContext();
            ctx.Request.Path = new PathString(path);

            var level = RequestLoggingPathPolicy.GetLevel(ctx, elapsedMs: 1, ex: null);

            level.Should().Be(LogEventLevel.Verbose);
        }

        [Theory]
        [InlineData("/api/health/live")]
        [InlineData("/api/health/ready")]
        [InlineData("/API/health/live")]
        public void GetLevel_HealthProbes_ShouldReturnVerbose_DespiteBeingApi(string path)
        {
            var ctx = new DefaultHttpContext();
            ctx.Request.Path = new PathString(path);

            var level = RequestLoggingPathPolicy.GetLevel(ctx, elapsedMs: 1, ex: null);

            level.Should().Be(LogEventLevel.Verbose);
        }

        [Theory]
        [InlineData("/api/projects")]
        [InlineData("/api/expenses")]
        [InlineData("/api/health/other")]
        public void GetLevel_ApiPaths_ShouldReturnInformation(string path)
        {
            var ctx = new DefaultHttpContext();
            ctx.Request.Path = new PathString(path);

            var level = RequestLoggingPathPolicy.GetLevel(ctx, elapsedMs: 1, ex: null);

            level.Should().Be(LogEventLevel.Information);
        }

        [Theory]
        [InlineData("/Push")]
        [InlineData("/push/public-key")]
        [InlineData("/PUSH/register")]
        public void GetLevel_PushControllerRoutes_ShouldReturnInformation(string path)
        {
            var ctx = new DefaultHttpContext();
            ctx.Request.Path = new PathString(path);

            var level = RequestLoggingPathPolicy.GetLevel(ctx, elapsedMs: 1, ex: null);

            level.Should().Be(LogEventLevel.Information);
        }

        [Theory]
        [InlineData("/apixxx/whatever")]
        [InlineData("/apitemp")]
        [InlineData("/pushkin")]
        public void GetLevel_MisleadingPrefixes_ShouldReturnVerbose(string path)
        {
            // Only actual api/push path segments count, not lookalike prefixes.
            var ctx = new DefaultHttpContext();
            ctx.Request.Path = new PathString(path);

            var level = RequestLoggingPathPolicy.GetLevel(ctx, elapsedMs: 1, ex: null);

            level.Should().Be(LogEventLevel.Verbose);
        }

        [Fact]
        public void GetLevel_ApiPathWithErrorStatus_ShouldReturnError()
        {
            var ctx = new DefaultHttpContext();
            ctx.Request.Path = new PathString("/api/projects");
            ctx.Response.StatusCode = 500;

            var level = RequestLoggingPathPolicy.GetLevel(ctx, elapsedMs: 1, ex: null);

            level.Should().Be(LogEventLevel.Error);
        }

        [Fact]
        public void GetLevel_ApiPathWithException_ShouldReturnError()
        {
            var ctx = new DefaultHttpContext();
            ctx.Request.Path = new PathString("/api/projects");

            var level = RequestLoggingPathPolicy.GetLevel(ctx, elapsedMs: 1, ex: new Exception("boom"));

            level.Should().Be(LogEventLevel.Error);
        }

        [Fact]
        public void GetLevel_HealthProbeWithErrorStatus_ShouldRemainVerbose()
        {
            // Health endpoints and other excluded paths should never surface in the
            // request logs, even when they return an error status.
            var ctx = new DefaultHttpContext();
            ctx.Request.Path = new PathString("/api/health/ready");
            ctx.Response.StatusCode = 503;

            var level = RequestLoggingPathPolicy.GetLevel(ctx, elapsedMs: 1, ex: null);

            level.Should().Be(LogEventLevel.Verbose);
        }
    }
}
