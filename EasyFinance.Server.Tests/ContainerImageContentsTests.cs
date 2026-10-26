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
    /// a deployment, when they are expensive â€” so the rules are asserted here rather than
    /// left to review.
    /// </para>
    ///
    /// <para>
    /// <b>What this class guards now.</b> The image used to carry a second executable: a
    /// data-migration host published to <c>/app/migrator</c>, which needed an
    /// <c>aspnet</c>-based stage rather than <c>runtime</c> because it transitively pulled
    /// in <c>Microsoft.AspNetCore.App</c>. The migration completed and all of that was
    /// removed â€” the host, the separate migrations project it loaded by name, and the
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
    ///     built from a branch without merging â€” and must not move <c>latest</c> when it
    ///     is, or a branch build becomes what the cluster deploys.
    ///   </item>
    ///   <item>
    ///     There must be exactly one release workflow. It used to be two â€” one uploading a
    ///     Windows publish over FTP, one pushing the image â€” which is why this class read
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
        /// <c>workflow_dispatch</c> trigger while leaving the comment in place â€” the
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
    /// One process. The Server already serves the Angular bundle through
    /// <c>UseDefaultFiles()</c> / <c>UseStaticFiles()</c>, and the application calls the API
    /// with bare <c>/api/...</c> URLs on its own origin, so nothing between the browser and
    /// Kestrel was ever needed. The image used to run nginx behind an entrypoint that wrote
    /// its configuration from the environment at start-up; that only relocated the public
    /// port and hid a dead API behind a front door that kept answering.
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

        /// <summary>
        /// The Dockerfile's instructions, with every comment line removed.
        ///
        /// <para>
        /// Load-bearing, for the same reason as <c>WorkflowWithoutComments</c> in
        /// <see cref="ContainerImageContentsTests"/>: the Dockerfile documents what was
        /// removed, so "does the file mention nginx" is answered yes by the explanation of why
        /// nginx is gone. The guards below assert on what the build does.
        /// </para>
        /// </summary>
        private static string DockerfileInstructions(string dockerfile) =>
            string.Join(
                "\n",
                dockerfile
                    .Split('\n')
                    .Select(line => line.TrimEnd())
                    .Where(line => !line.TrimStart().StartsWith("#", StringComparison.Ordinal)));

        [Fact]
        public void TheImage_ShouldBuildTheSpaWithTheBrowserPipeline()
        {
            var dockerfile = Dockerfile();

            // `ng build` with the production configuration emits dist/easyfinance.client/browser.
            // That directory is copied into the Server's wwwroot, which is where
            // UseStaticFiles() serves it from.
            dockerfile.Should().Contain(
                "ng build --configuration production",
                "the image must ship the browser build, not the SSR/prerender output");

            dockerfile.Should().Contain(
                "wwwroot",
                "the Angular bundle is served by the Server from wwwroot, not by a web server "
                + "next to it");
        }

        [Fact]
        public void TheImage_ShouldRunOneProcessAndNoEntrypoint()
        {
            // Everything the entrypoint supervised (a second process, a rendered web-server
            // configuration, a port-collision guard) exists only because there were two
            // processes. One process needs none of it.
            //
            // The check runs against the instructions only: this file explains at length what
            // was removed, and a plain "does it contain nginx" check is satisfied by that
            // prose - the same false negative the workflow guards run into.
            var instructions = DockerfileInstructions(Dockerfile());

            foreach (var removed in new[] { "nginx", "tini", "entrypoint" })
            {
                instructions.Should().NotContain(
                    removed,
                    $"{removed} is part of the two-process layout: the Server serves the SPA "
                    + "itself, so there is nothing for a front door or an init process to do");
            }

            // The dev image is dockered from this one, so the folder stays - but the entrypoint
            // scripts it used to hold are gone.
            foreach (var script in new[] { "entrypoint.sh", "dev-entrypoint.sh" })
            {
                File.Exists(Path.Combine(RepoRoot(), "docker", script)).Should().BeFalse(
                    $"{script} supervised the second process; there is no second process");
            }

            instructions.Should().Contain(
                "ENTRYPOINT [\"dotnet\", \"EasyFinance.Server.dll\"]",
                "Kestrel is PID 1 of the container, so a stop reaches it directly");
        }

        [Fact]
        public void TheImage_ShouldListenOnOnePort()
        {
            // The port the deployment already targets: the k8s probes and `docker run -p
            // 8080:8080` from the docs. The SPA and /api share it because they share the
            // process.
            var dockerfile = Dockerfile();

            dockerfile.Should().Contain(
                "ASPNETCORE_HTTP_PORTS=8080",
                "Kestrel is the container's only listener, on the published port");
        }

        [Fact]
        public void TheImage_ShouldRunOnTheAlpineRuntime()
        {
            // The ASP.NET runtime image shipped in place of the Debian one. The Alpine variant
            // carries no time-zone database and no ICU, which is why the image takes the
            // `-extra` tag - see AlpineRuntimeTests for why the application needs both.
            var instructions = DockerfileInstructions(Dockerfile());

            instructions.Should().Contain(
                "FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine-extra",
                "the runtime stage must be the small Alpine variant");
        }

        [Fact]
        public void TheImage_ShouldProbeTheSpaAndTheApi()
        {
            // One probe is enough for a single process, but it has to prove both halves: a
            // live Kestrel answers /api/health/live even when the SPA was never copied into
            // wwwroot, and the container would then look healthy while every page 404s.
            var instructions = DockerfileInstructions(Dockerfile());

            instructions.Should().Contain(
                "HEALTHCHECK",
                "the image must declare a health check so the deployment can tell a dead "
                + "instance from a live one");

            var healthcheck = instructions
                .Split('\n')
                .FirstOrDefault(line => line.TrimStart().StartsWith("CMD", StringComparison.Ordinal))
                ?? string.Empty;

            healthcheck.Should().Contain(
                "/api/health/live",
                "the probe must prove the API answers");

            healthcheck.Should().Contain(
                "/index.html",
                "and that the SPA shell is served, which a healthy API alone does not prove");
        }

        [Fact]
        public void TheImage_ShouldDropRoot()
        {
            // The published application writes attachments under its base directory and needs
            // nothing else; running as the image's own APP_UID keeps that writable without
            // handing the process root.
            var dockerfile = Dockerfile();

            dockerfile.Should().Contain(
                "USER $APP_UID",
                "the runtime user is the non-root one declared by the ASP.NET image");

            // The base directory has to belong to that user or applying the EF migrations
            // cannot write and every upload turns into a 500.
            dockerfile.Should().Contain(
                "chown -R \"$APP_UID\"",
                "the published application must be owned by the runtime user");
        }

        [Fact]
        public void TheDevImage_ShouldDifferFromTheReleaseImageOnlyWhereDevelopmentNeedsIt()
        {
            // The two Dockerfiles described the same layout twice, and drifted: one set of
            // tests guarded nginx in the release image while another guarded it in the dev
            // image. Docker cannot share stages across Dockerfiles - only another image's
            // final stage can be imported - so the stages are repeated on purpose, and the
            // guards below are what keep the repetition honest: same runtime, same ports
            // scheme, and nothing between the browser and Kestrel in either image.
            var dev = Read("docker", "Dockerfile.dev");
            var release = Read("Dockerfile");

            dev.Should().Contain(
                "ASPNETCORE_ENVIRONMENT=Development",
                "Development is what seeds the fixtures and replaces e-mail with a no-op sender");

            dev.Should().Contain(
                "-p:DefineConstants=DEBUG",
                "a Release build without DEBUG turns GenericRepository.Insert into a no-op");

            // Both images run the same base images and the same bundle pipeline. A dev image
            // built from a different runtime is a stack whose behaviour differs from the
            // deployed one in ways nobody is testing.
            dev.Should().Contain(
                "mcr.microsoft.com/dotnet/aspnet:10.0-alpine-extra",
                "the Development image must run the runtime the release image ships");

            dev.Should().Contain(
                "ng build --configuration production",
                "the stack serves the bundle the release image serves");

            // No second process in the dev image either: the reason nginx was removed applies
            // twice over in a stack that is meant to behave like production.
            DockerfileInstructions(dev).Should().NotContain(
                "nginx",
                "the SPA is served by the server itself in both images");

            release.Should().NotContain(
                "DefineConstants=DEBUG",
                "DEBUG is a Development-only define");
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
    /// regression at all.
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
