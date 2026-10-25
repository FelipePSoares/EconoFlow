using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using FluentAssertions;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards the container image's build definition and publish workflow.
    ///
    /// <para>
    /// These are not style checks. The Dockerfile encodes facts that are invisible until
    /// a deployment, when they are expensive — so the rules are asserted here rather than
    /// left to review.
    /// </para>
    ///
    /// <para>
    /// <b>What this class guards now.</b> The image used to carry a second executable: a
    /// data-migration host published to <c>/app/migrator</c>, which needed an
    /// <c>aspnet</c>-based stage rather than <c>runtime</c> because it transitively pulled
    /// in <c>Microsoft.AspNetCore.App</c>. The migration completed and all of that was
    /// removed — the host, the separate migrations project it loaded by name, and the
    /// migrator stage. The tests below now assert the removal, plus the two properties
    /// that still matter:
    /// </para>
    ///
    /// <list type="bullet">
    ///   <item>
    ///     The image must not reference the deleted projects. A stale <c>COPY</c> fails
    ///     the build, and a stale <c>ProjectReference</c> would silently reintroduce a
    ///     dependency on code that no longer exists.
    ///   </item>
    ///   <item>
    ///     The release workflow must keep <c>workflow_dispatch</c>, so an image can be
    ///     built from a branch without merging — and must not move <c>latest</c> when it
    ///     is, or a branch build becomes what the cluster deploys.
    ///   </item>
    ///   <item>
    ///     There must be exactly one release workflow. It used to be two — one uploading a
    ///     Windows publish over FTP, one pushing the image — which is why this class read
    ///     <c>docker-publish.yml</c>; the FTP host is gone and <c>Release.yml</c> now does
    ///     both the image and the APK.
    ///   </item>
    /// </list>
    /// </summary>
    public class ContainerImageContentsTests
    {
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

        private static string Dockerfile() => File.ReadAllText(Path.Combine(RepoRoot(), "Dockerfile"));

        private static string PublishWorkflow() => File.ReadAllText(
            Path.Combine(RepoRoot(), ".github", "workflows", "Release.yml"));

        [Fact]
        public void Dockerfile_ShouldNotReferenceTheRemovedMigrationProjects()
        {
            // The migrator host and the separate PostgreSQL persistence project are gone:
            // the data migration finished and its tooling was deleted. A Dockerfile that
            // still COPYs them fails the build with 'not found', which is at least loud -
            // but it would also mean the removal was incomplete.
            var dockerfile = Dockerfile();

            dockerfile.Should().NotContain(
                "EconoFlow.DataMigration",
                "the data-migration host was removed once PostgreSQL became the only "
                + "database; there is no longer a source to copy from");

            dockerfile.Should().NotContain(
                "EasyFinance.Persistence.Postgres",
                "the separate PostgreSQL persistence project was merged into "
                + "EasyFinance.Persistence and deleted");
        }

        [Fact]
        public void Dockerfile_ShouldNotPublishAMigratorAnyMore()
        {
            Dockerfile().Should().NotMatchRegex(
                @"COPY\s+--from=build\s+/migrator",
                "the runtime image no longer carries a migrator: migrations are applied "
                + "by the application's own start-up (PersistenceServiceRegistration"
                + ".UseMigration), which is the only path that was ever exercised and the "
                + "one whose absence caused a production outage");
        }

        [Fact]
        public void ServerProject_ShouldReferenceThePersistenceProjectThatHoldsTheMigrations()
        {
            // The migrations now live in EasyFinance.Persistence, beside the contexts, so
            // this is the only reference the application needs. Assert it explicitly: a
            // previous revision named an assembly it did not reference, and start-up died
            // with FileNotFoundException after a successful build.
            var csproj = File.ReadAllText(
                Path.Combine(RepoRoot(), "EasyFinance.Server", "EasyFinance.Server.csproj"));

            csproj.Should().Contain(
                "EasyFinance.Persistence.csproj",
                "the migrations live in this assembly now, so the Server must reference it");

            csproj.Should().NotContain(
                "EasyFinance.Persistence.Postgres",
                "that project no longer exists");
        }

        /// <summary>
        /// The workflow with its comments stripped.
        ///
        /// <para>
        /// Load-bearing: a plain "does the file contain this string" check is satisfied
        /// by a <i>comment</i> mentioning it. Verified by removing the real
        /// <c>workflow_dispatch</c> trigger while leaving the comment in place — the
        /// naive check still passed, which is a false negative in a guard whose whole
        /// job is to catch that removal.
        /// </para>
        /// </summary>
        private static string WorkflowWithoutComments() =>
            string.Join(
                "\n",
                PublishWorkflow()
                    .Split('\n')
                    .Select(line => line.TrimEnd())
                    .Where(line => !line.TrimStart().StartsWith("#", StringComparison.Ordinal)));

        [Fact]
        public void PublishWorkflow_ShouldSupportManualDispatch()
        {
            WorkflowWithoutComments().Should().MatchRegex(
                @"(?m)^\s{2}workflow_dispatch:\s*$",
                "an image must be buildable from a branch without merging, so the "
                + "cutover can resolve and record a digest before the window");
        }

        [Fact]
        public void PublishWorkflow_ShouldNotMoveLatestWhenRunManuallyFromABranch()
        {
            var workflow = PublishWorkflow();

            // A manual run exists to produce a testable digest. If it also moved
            // `latest`, a branch build would silently become the image the cluster
            // deploys the moment automation resumes - which is exactly what the
            // freeze is protecting against.
            //
            // `latest` is assigned only inside the branch that checks for master, so
            // assert both halves: the tag is mentioned, and it is guarded by the ref.
            workflow.Should().Contain(
                ":latest",
                "the release path is expected to tag latest");

            workflow.Should().Contain(
                "github.ref",
                "the latest tag must be conditional on the ref, so a manual run from a "
                + "branch publishes only a ref-scoped tag and cannot move latest");

            // The guard must be a real comparison against master, not a mention.
            Regex.IsMatch(workflow, @"""\$\{\{\s*github\.ref\s*\}\}""\s*=\s*""refs/heads/master""")
                .Should().BeTrue(
                    "the workflow must compare github.ref against refs/heads/master to "
                    + "decide whether latest may move");
        }
    }

    /// <summary>
    /// Guards how the image serves the SPA.
    ///
    /// <para>
    /// The image runs the API and nginx in one container: nginx is the front door, serves
    /// the Angular browser bundle, and proxies <c>/api</c> to Kestrel on the loopback
    /// interface so the SPA and the API share one origin. Each of those links is invisible
    /// until a deployment — a missing <c>try_files</c> turns every deep link into a 404, a
    /// missing proxy breaks every API call, and abandoning <c>ng build</c> for the SSR
    /// pipeline ships pages that render empty.
    /// </para>
    /// </summary>
    public class ContainerSpaServingTests
    {
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

        private static string Read(params string[] parts) =>
            File.ReadAllText(Path.Combine([RepoRoot(), .. parts]));

        private static string Dockerfile() => Read("Dockerfile");

        // The nginx site is rendered by the entrypoint from ECONOFLOW_NGINX_PORT and
        // ECONOFLOW_API_PORT at start-up, so these are asserted against the entrypoint.
        private static string Entrypoint() => Read("docker", "entrypoint.sh");

        [Fact]
        public void TheImage_ShouldBuildTheSpaWithTheBrowserPipeline()
        {
            var dockerfile = Dockerfile();

            // `ng build` with the production configuration emits dist/easyfinance.client/browser.
            // Switching to the SSR/prerender pipeline would substitute index.csr.html for every
            // prerendered page — and its serialized state renders an empty app.
            dockerfile.Should().Contain(
                "ng build --configuration production",
                "the image must ship the browser build, not the SSR/prerender output");

            dockerfile.Should().Contain(
                "dist/easyfinance.client/browser/",
                "the browser bundle is what nginx serves");
        }

        [Fact]
        public void TheImage_ShouldRunNginxInFrontOfTheApi()
        {
            var dockerfile = Dockerfile();

            dockerfile.Should().Contain(
                "econoflow-entrypoint",
                "the container needs the entrypoint that starts and supervises both services");

            // The API's binding is applied by the entrypoint, not as an ENV in the Dockerfile:
            // the entrypoint is what knows the port and starts Kestrel on it. Being an ENV
            // would also let an operator widen it to 0.0.0.0, exposing the API next to nginx.
            Entrypoint().Should().Contain(
                "ASPNETCORE_URLS=\"http://127.0.0.1:${API_PORT}\"",
                "Kestrel must bind the loopback interface, so only nginx is reachable");

            dockerfile.Should().Contain(
                "EXPOSE 8080",
                "nginx listens on 8080 and is the container's only public port");

            dockerfile.Should().Contain(
                "tini",
                "an init process is what stops both services on a container stop and "
                + "propagates either one exiting");
        }

        [Fact]
        public void Nginx_ShouldServeDeepLinksFromTheSpaShell()
        {
            Entrypoint().Should().MatchRegex(
                @"try_files\s+\\\$uri\s+\\\$uri/index\.html\s+/index\.html",
                "an Angular route has no file of its own; without the index.html fallback "
                + "every hard refresh on a deep link answers 404");
        }

        [Fact]
        public void Nginx_ShouldProxyTheApiToTheLoopbackApi()
        {
            var conf = Entrypoint();

            conf.Should().Contain(
                "proxy_pass http://econoflow_api/api/",
                "the SPA calls /api on its own origin; nginx is what forwards that to Kestrel");

            conf.Should().Contain(
                "server 127.0.0.1:${API_PORT}",
                "the upstream must be the loopback API, on the port the entrypoint gives Kestrel");
        }

        [Fact]
        public void Nginx_ShouldForwardTheProxiedScheme()
        {
            // The application enables Hsts() and UseHttpsRedirection() and honours
            // UseForwardedHeaders. Without X-Forwarded-Proto every request looks like plain
            // HTTP, so the API would redirect the SPA's own API calls to https://...:443.
            Entrypoint().Should().Contain(
                "proxy_set_header X-Forwarded-Proto \\$scheme",
                "the API must see the scheme the browser used, not the internal hop");
        }

        [Fact]
        public void Nginx_ShouldNeverCacheTheServiceWorkersOrTheShell()
        {
            // A cached index.html or service worker pins an installed PWA to the previous
            // deploy: the app would keep loading stale hashed bundles forever.
            var conf = Entrypoint();

            foreach (var protectedPath in new[] { "/index.html", "/ngsw-worker.js", "/ngsw.json", "/service-worker.js" })
            {
                conf.Should().Contain(
                    protectedPath,
                    $"{protectedPath} must be addressed explicitly so it can be marked no-store");
            }

            Regex.Matches(conf, @"add_header Cache-Control ""no-store""")
                .Count.Should().BeGreaterThanOrEqualTo(
                    4,
                    "each of the shell and the three service-worker entry points must be no-store");
        }
    }

    /// <summary>
    /// Guards the Cypress job's database, which was silently the wrong one.
    ///
    /// <para>
    /// <c>integration-tests</c> starts the application and runs <c>npx cypress run</c>
    /// against it — but it exported no <c>EasyFinanceDB</c>, so the job ran in
    /// Development against the <i>in-memory</i> store. PostgreSQL is the only database
    /// the application has, so the end-to-end suite could not detect a PostgreSQL
    /// regression at all: the month-scoping defects found while consolidating the
    /// persistence layer pass in CI because the in-memory fixtures carry different
    /// dates.
    /// </para>
    ///
    /// <para>
    /// These are assertions on the workflow file because the alternative — starting a
    /// container and a host inside a unit test — would put a database in every developer's
    /// test run to prove something the YAML already states.
    /// </para>
    /// </summary>
    public class CypressWorkflowDatabaseTests
    {
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

        private static string IntegrationJob()
        {
            var workflow = File.ReadAllText(
                Path.Combine(RepoRoot(), ".github", "workflows", "BuildAndTests.yml"));

            var jobStart = workflow.IndexOf("  integration-tests:", StringComparison.Ordinal);

            jobStart.Should().BeGreaterThan(-1, "the workflow is expected to have an integration-tests job");

            var nextJob = workflow.IndexOf("\n  script-tests:", StringComparison.Ordinal);

            if (nextJob < 0 || nextJob < jobStart)
                nextJob = workflow.Length;

            return workflow.Substring(jobStart, nextJob - jobStart);
        }

        [Fact]
        public void CypressJob_ShouldRunAgainstPostgreSql()
        {
            var job = IntegrationJob();

            job.Should().Contain(
                "EasyFinanceDB",
                "the Cypress job must point the application at PostgreSQL; without it "
                + "Development falls back to the in-memory store, which has no schema "
                + "and no migrations, so the job cannot exercise the production database");
        }

        [Fact]
        public void CypressJob_ShouldStartAPostgreSqlService()
        {
            var job = IntegrationJob();

            job.Should().MatchRegex(
                @"(?m)^\s{4}services:\s*$",
                "a PostgreSQL service container is what makes EasyFinanceDB reachable");
        }

        [Fact]
        public void CypressJob_ShouldRunThePostgresEngineVersionProductionRuns()
        {
            // The suite exists to catch regressions in the database the application is
            // deployed against. Running it on 16 while production runs 18 would prove
            // nothing about the deployed engine, and a floating tag such as `16-alpine`
            // would move without anyone deciding to.
            const string productionImage =
                "postgres:18-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2";

            IntegrationJob().Should().Contain(
                $"image: {productionImage}",
                "the CI database must be the image production runs, pinned by digest");

            IntegrationJob().Should().NotContain(
                "postgres:16",
                "the suite would then validate an engine version that is not deployed");
        }

        [Fact]
        public void CypressJob_ShouldSeedItsFixtureUserExplicitly()
        {
            // The fixtures are skipped for a relational store, but every Cypress spec
            // signs in as the seeded test@test.com. Pointing the job at PostgreSQL
            // without this variable fails the whole suite at login.
            IntegrationJob().Should().Contain(
                "EconoFlow_SEED_DEVELOPMENT_DATA",
                "the Cypress suite depends on the development fixtures, which are "
                + "skipped by default for a real database");
        }
    }
}
