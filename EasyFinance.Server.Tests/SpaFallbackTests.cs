using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using EasyFinance.Server.Routing;
using FluentAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Xunit;


namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards the SPA's client-side routes.
    ///
    /// <para>
    /// The Angular build is a prerender/SSR build: <c>angular.json</c> prerenders the handful of
    /// routes listed in <c>src/prerender-routes.txt</c>, and the image copies only
    /// <c>dist/…/browser/</c> into <c>wwwroot</c>. The server answered those files and nothing
    /// else - <c>UseDefaultFiles()</c> + <c>UseStaticFiles()</c> + <c>MapControllers()</c> - so a
    /// route such as <c>/projects/{id}/categories/{id}/expenses</c>, which has no file because it
    /// is rendered from data at run time, was a genuine 404.
    /// </para>
    ///
    /// <para>
    /// Opening a project, category or expense directly - or refreshing one - therefore failed on
    /// anything that serves the built bundle. CI never noticed, because CI runs the suite against
    /// <c>ng serve</c>, which answers every path itself. It surfaced as soon as the docker stack
    /// started successfully and Cypress could drive it.
    /// </para>
    ///
    /// <para>
    /// These are end-to-end tests over a real routing pipeline, not unit tests of a predicate:
    /// what matters is that a controller route still wins, and that an unknown page path reaches
    /// the client instead of the 404.
    /// </para>
    /// </summary>
    public class SpaFallbackTests
    {
        private const string ClientShell = "<html><body><app-root></app-root></body></html>";

        /// <summary>
        /// A project route, as the SPA's router declares it - no file exists for this path.
        /// </summary>
        private const string ProjectDeepLink = "/projects/abc/categories/def/expenses";

        /// <summary>
        /// The pipeline Program.cs builds, with a stub controller standing in for the API and
        /// {@link SpaFallback} as the last thing registered.
        /// </summary>
        /// <summary>
        /// A real wwwroot on disk holding the built shell, and no file for any route.
        ///
        /// A fake <c>IFileProvider</c> was tempting and wrong: the request has to be served
        /// through the same static-file pipeline the application uses, or the test proves
        /// nothing about how the shell is actually handed over.
        /// </summary>
        private static string CreateWebRoot()
        {
            var webRoot = Path.Combine(Path.GetTempPath(), $"spa-fallback-{Guid.NewGuid():N}");
            Directory.CreateDirectory(webRoot);
            File.WriteAllText(Path.Combine(webRoot, "index.csr.html"), ClientShell);
            File.WriteAllText(Path.Combine(webRoot, "main-ABC123.js"), "console.log('bundle');");
            return webRoot;
        }

        private static HttpClient StartClient(bool withFallback = true)
        {
            var webRoot = CreateWebRoot();

            var host = new HostBuilder()
                .ConfigureWebHost(webHost =>
                {
                    webHost.UseTestServer();
                    webHost.UseWebRoot(webRoot);
                    webHost.ConfigureServices(services => services.AddRouting());
                    webHost.Configure(app =>
                    {
                        // Serves the shell and the bundle - the prerendered pages would be here
                        // too - but nothing for a data-driven route.
                        app.UseStaticFiles();

                        app.UseRouting();
                        app.UseEndpoints(endpoints =>
                        {
                            endpoints.MapGet("/api/probe", context => context.Response.WriteAsync("api"));
                        });

                        // The last thing Program.cs registers, under test.
                        if (withFallback)
                        {
                            app.UseSpaFallback();
                        }
                    });
                })
                .Build();

            host.Start();
            return host.GetTestClient();
        }
        [Fact]
        public async Task DeepLink_ShouldServeTheClientShell_Not404()
        {
            // The regression, end to end: a project/category/expense URL typed or refreshed
            // directly. Without the fallback the response is a 404 and the SPA is never given a
            // chance to route.
            using var client = StartClient();

            var response = await client.GetAsync(ProjectDeepLink);

            response.StatusCode.Should().Be(HttpStatusCode.OK,
                "a client-side route has no file, so something has to hand the shell over");
            (await response.Content.ReadAsStringAsync()).Should().Be(ClientShell);
        }

        [Fact]
        public async Task DeepLink_WithoutTheFallback_IsThe404ThisGuardsAgainst()
        {
            // Pins the cause, so the test above cannot be satisfied by an unrelated change: the
            // same pipeline without the fallback answers the deep link with a 404.
            using var client = StartClient(withFallback: false);

            var response = await client.GetAsync(ProjectDeepLink);

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task ApiRoutes_ShouldStillBeAnsweredByControllers()
        {
            // The fallback is last, so a real endpoint wins. An API path answered with HTML would
            // break every `cy.request()` in the suite, and the application itself.
            using var client = StartClient();

            var response = await client.GetAsync("/api/probe");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            (await response.Content.ReadAsStringAsync()).Should().Be("api");
        }

        [Fact]
        public async Task UnknownApiRoute_ShouldNotBeAnsweredWithHtml()
        {
            // A path under /api is the API's namespace, never a page. Answering it with the shell
            // turns a clear 404 into a confusing "unexpected token '<'" in anything that parses
            // the response.
            using var client = StartClient();

            var response = await client.GetAsync("/api/this/does/not/exist");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await response.Content.ReadAsStringAsync()).Should().NotContain("<html");
        }

        [Fact]
        public async Task StaticAssets_ShouldNotBeAnsweredWithTheShell()
        {
            // A missing hashed bundle must stay a 404: serving the shell in its place makes the
            // browser parse HTML as JavaScript, which turned a deploy-skew 404 into a blank page.
            using var client = StartClient();

            var response = await client.GetAsync("/main-DOESNOTEXIST.js");

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await response.Content.ReadAsStringAsync()).Should().NotContain("<html");
        }

        [Theory]
        [InlineData("/api/Projects")]
        [InlineData("/api/health/ready")]
        [InlineData("/api/AccessControl/login")]
        public async Task EveryApiPath_ShouldBeTreatedAsApi(string path)
        {
            SpaFallback.IsClientRoute(new PathString(path), "GET").Should().BeFalse();
        }

        [Theory]
        [InlineData("/projects/abc/categories/def/expenses")]
        [InlineData("/projects/abc/overview/monthly")]
        [InlineData("/login")]
        [InlineData("/pt/privacy-policy")]
        public async Task PagePaths_ShouldBeTreatedAsClientRoutes(string path)
        {
            SpaFallback.IsClientRoute(new PathString(path), "GET").Should().BeTrue();
        }

        [Fact]
        public void FilesWithAnExtension_AreNotClientRoutes()
        {
            SpaFallback.IsClientRoute(new PathString("/main-ABC123.js"), "GET").Should().BeFalse();
            SpaFallback.IsClientRoute(new PathString("/assets/images/logo.png"), "GET").Should().BeFalse();
            SpaFallback.IsClientRoute(new PathString("/manifest.webmanifest"), "GET").Should().BeFalse();
        }

        [Theory]
        [InlineData("POST")]
        [InlineData("PATCH")]
        [InlineData("DELETE")]
        [InlineData("PUT")]
        public void NonGetRequests_AreNotClientRoutes(string method)
        {
            SpaFallback.IsClientRoute(new PathString("/projects/abc/categories/def/expenses"), method)
                .Should().BeFalse("the fallback exists to hand pages to the router, not to answer writes");
        }

        [Fact]
        public void Program_ShouldRegisterTheFallbackAfterTheControllers()
        {
            // The tests above prove the fallback works; this pins the WIRING, which is what
            // actually regressed. A fallback that is never registered - or registered before the
            // controllers, where it would answer /api with HTML - is asserted against Program.cs
            // rather than by starting the host, the way DevelopmentSeederSafetyTests pins the
            // seeding wiring.
            var program = File.ReadAllText(Path.Combine(RepoRoot(), "EasyFinance.Server", "Program.cs"));

            // Comment lines are dropped first: a commented-out call is not a registration, and a
            // plain substring search is answered by the comment that explains the call.
            var executable = string.Join(
                "\n",
                program
                    .Split('\n')
                    .Select(line => line.TrimEnd())
                    .Where(line => !line.TrimStart().StartsWith("//", StringComparison.Ordinal)));

            var controllers = executable.IndexOf("app.MapControllers();", StringComparison.Ordinal);
            var fallback = executable.IndexOf("app.UseSpaFallback();", StringComparison.Ordinal);

            controllers.Should().BeGreaterThan(-1, "Program.cs is expected to map the controllers");
            fallback.Should().BeGreaterThan(
                controllers,
                "the fallback must come after the controllers, or it answers /api with the SPA shell");

            executable.Should().NotContain(
                "MapFallbackToFile",
                "MapFallbackToFile answers EVERY unmatched request, so a missing bundle would be "
                + "served the shell and the browser would parse HTML as JavaScript");
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
    }
}
