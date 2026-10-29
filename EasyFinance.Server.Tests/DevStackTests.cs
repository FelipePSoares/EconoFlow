using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using FluentAssertions;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards the local development stack: <c>docker-compose.dev.yml</c> plus the image it
    /// builds (<c>docker/Dockerfile.dev</c>).
    ///
    /// <para>
    /// The stack runs PostgreSQL 18 and the application, and nothing else. It exists so the
    /// application can be run and exercised on a developer machine without installing a
    /// database — and so the end-to-end suite in <c>easyfinance.client</c> can be run
    /// against it with <c>npx cypress run</c> instead of testing by hand, exactly as the
    /// <c>integration-tests</c> job does in CI.
    /// </para>
    ///
    /// <para>
    /// Like the release image, the stack's correctness lives in facts that are invisible
    /// until it is built and started: which PostgreSQL tag it runs, which environment and
    /// which build configuration reach the application, and whether the browser's own origin
    /// can reach the API. Each of those was wrong at least once while this stack was written,
    /// and each failed at run time rather than at build time, so they are asserted here.
    /// </para>
    /// </summary>
    public class DevStackTests
    {
        private const string ComposeFile = "docker-compose.dev.yml";

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

        private static string Compose() => Read(ComposeFile);

        private static string DevImage() => Read("docker", "Dockerfile.dev");

        /// <summary>
        /// The image definition with its comment lines removed.
        ///
        /// <para>
        /// Load-bearing: both Dockerfiles explain in prose what was removed and why, so a plain
        /// "does it contain nginx" check is answered by the explanation. These guards are about
        /// what the build runs.
        /// </para>
        /// </summary>
        private static string DevImageInstructions() =>
            string.Join(
                "\n",
                DevImage()
                    .Split('\n')
                    .Where(line => !line.TrimStart().StartsWith("#", StringComparison.Ordinal)));

        /// <summary>
        /// The compose file with its comments stripped.
        ///
        /// <para>
        /// Load-bearing, for the same reason as <c>WorkflowWithoutComments</c> in
        /// <see cref="ContainerImageContentsTests"/>: this file documents the reasoning
        /// behind its settings in comments, so a plain "does it contain this string" check
        /// is satisfied by the prose that explains why the string is needed.
        /// </para>
        /// </summary>
        private static string ComposeWithoutComments() =>
            string.Join(
                "\n",
                Compose()
                    .Split('\n')
                    .Select(line => line.TrimEnd())
                    .Where(line => !line.TrimStart().StartsWith("#", StringComparison.Ordinal)));

        [Fact]
        public void Compose_ShouldRunPostgreSql18()
        {
            // The stack exists to exercise the database the application is deployed on. A
            // floating tag such as `postgres:18-alpine` - or a stack left on 16 - would test
            // an engine nobody deploys.
            ComposeWithoutComments().Should().MatchRegex(
                @"(?m)^\s+image:\s*postgres:18-alpine@sha256:[0-9a-f]{64}\s*$",
                "the local stack must run the same minor of PostgreSQL 18 as production, "
                + "pinned by digest so the tag cannot move underneath it");
        }

        [Fact]
        public void Compose_ShouldRunTheSamePostgreSqlDigestAsCi()
        {
            // Two places would drift silently: CI would go green on an engine the local
            // stack no longer runs (or the reverse), which defeats the point of having
            // both. Moving the digest is a decision, so it has to be made in both.
            var digest = Regex.Match(
                Compose(),
                @"postgres:18-alpine@sha256:[0-9a-f]{64}").Value;

            digest.Should().NotBeEmpty("the compose stack is expected to pin the PostgreSQL image");

            Read(".github", "workflows", "BuildAndTests.yml").Should().Contain(
                digest,
                "the local stack and the integration-tests job must run the same PostgreSQL image");
        }

        [Fact]
        public void Compose_ShouldRunOnlyTheDatabaseAndTheApplication()
        {
            // The stack runs the app locally; the end-to-end suite runs from the host, as it
            // does in CI. A Cypress service here would be a second, drifting definition of
            // how the suite is run.
            ComposeWithoutComments().Should().NotContain(
                "cypress/included",
                "Cypress runs on the developer's machine, not in the stack");

            ComposeWithoutComments().Should().NotMatchRegex(
                @"(?m)^\s{2}cypress:\s*$",
                "the stack runs only the database and the application");
        }

        [Fact]
        public void Compose_ShouldRunTheApplicationInDevelopment()
        {
            // Development is what seeds the sample data, turns e-mail into the no-op sender,
            // and is the only environment in which the seeding may run at all.
            ComposeWithoutComments().Should().MatchRegex(
                @"(?m)^\s+-\s*ASPNETCORE_ENVIRONMENT=Development\s*$",
                "the stack serves the Development application");
        }

        [Fact]
        public void Compose_ShouldPointTheApplicationAtThePostgreSqlService()
        {
            ComposeWithoutComments().Should().MatchRegex(
                @"(?m)^\s+-\s*EasyFinanceDB=Host=[a-z0-9_-]+;",
                "without a Host= connection string Development falls back to the in-memory "
                + "store, so the stack would not exercise PostgreSQL at all");
        }

        [Fact]
        public void Compose_ShouldSeedTheSampleData()
        {
            // The seeding skips itself for a relational store unless asked explicitly, and
            // the seeded user is the one the end-to-end suite signs in as. Without this the
            // stack starts with an empty database and the suite fails at login.
            ComposeWithoutComments().Should().MatchRegex(
                @"(?m)^\s+-\s*EconoFlow_SEED_DEVELOPMENT_DATA=true\s*$",
                "the sample data is skipped by default for a real database");
        }

        [Fact]
        public void Compose_ShouldStartOnlyAfterPostgreSqlAcceptsConnections()
        {
            // UseMigration() runs before the first request is served. With a plain
            // container dependency the application can start while PostgreSQL is still
            // initialising its data directory, and then dies on the first connection.
            Compose().Should().MatchRegex(
                @"(?s)depends_on:.*?condition:\s*service_healthy",
                "the application must wait for the database health check");

            Compose().Should().Contain(
                "pg_isready",
                "service_healthy is only meaningful when the service declares a health check "
                + "whose command proves PostgreSQL accepts connections");
        }

        [Fact]
        public void Compose_ShouldPublishTheWebAndApiPorts()
        {
            // 4200 is the origin the SPA is served from and the port the end-to-end suite's
            // default base URL uses; 7003 is the port `dotnet run` uses for the API. Both are
            // published on the loopback interface only: the database is seeded with known
            // credentials and nothing about this stack is meant to be reachable from the
            // network.
            var compose = ComposeWithoutComments();

            foreach (var (port, containerPort) in new[] { ("4200", "4200"), ("7003", "7003") })
            {
                var expected = $@"(?m)^\s+-\s*""127\.0\.0\.1:\$\{{[A-Z_]+:-{port}\}}:{containerPort}""\s*$";

                compose.Should().MatchRegex(
                    expected,
                    $"port {port} is what the application and the suite expect, bound to "
                    + "loopback and overridable when the port is taken");
            }
        }

        [Fact]
        public void Compose_ShouldPublishTwoPortsOfOneProcess()
        {
            // Both published ports belong to the single Kestrel process: the SPA and /api share
            // one origin on 4200, and the API answers on 7003 as well so `curl` and the mobile
            // emulator reach the endpoints without a proxy in between. It used to be two
            // listeners of nginx in front of a third (Kestrel on 8081), which is why the
            // compose file carried a port that nothing published.
            var compose = ComposeWithoutComments();

            compose.Should().NotContain(
                "8081",
                "there is no hidden backend port any more; 8081 was Kestrel's while nginx "
                + "owned the published ones");

            // The proxy in between is gone, so nothing configures an nginx upstream any more:
            // the API port is Kestrel's own listen port.
            Compose().Should().NotContain(
                "API" + "_PORT=" + "7003",
                "7003 is a listen port now, not the port of an upstream behind another server");
        }

        [Fact]
        public void Compose_ShouldKeepTheDatabaseAndTheObjectStorage()
        {
            // A `docker compose up` must not discard the sample data or the uploaded
            // attachments. Object storage is the only attachment backend now, so the uploads
            // live in MinIO - a named volume under /data - rather than in the application
            // container's own filesystem.
            var compose = ComposeWithoutComments();

            compose.Should().Contain(
                "var/lib/postgresql",
                "the PostgreSQL data directory must be a named volume");

            compose.Should().Contain(
                "/data",
                "MinIO's data directory must be a named volume, or every `up` discards the "
                + "attachments the end-to-end suite uploaded");

            compose.Should().NotContain(
                "/app/attachments",
                "the application no longer writes attachments to its own disk");
        }

        [Fact]
        public void Compose_ShouldRunObjectStorageForAttachments()
        {
            // The application has exactly one attachment backend and it is S3-compatible, so a
            // local stack without MinIO starts fine and then answers every upload with a 500.
            var compose = ComposeWithoutComments();

            compose.Should().MatchRegex(
                @"(?m)^\s{2}minio:\s*$",
                "uploads need a running MinIO service");

            compose.Should().MatchRegex(
                @"image:\s*ghcr\.io/coollabsio/minio:",
                "MinIO is no longer published on Docker Hub, so the stack runs the GHCR image");

            compose.Should().Contain(
                "mc ready",
                "the MinIO image has no wget or curl; its own mc client is the health check");

            foreach (var variable in new[] { "S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET" })
            {
                compose.Should().Contain(
                    $"{variable}=",
                    $"{variable} is read by Program.cs and without it attachment storage cannot "
                    + "be created");
            }

            compose.Should().MatchRegex(
                @"S3_ENDPOINT=minio",
                "the endpoint has to name the MinIO service on the compose network");
        }

        [Fact]
        public void Compose_ShouldStartOnlyAfterMinioIsReady()
        {
            // The same trap as PostgreSQL: the application creates its storage client and its
            // readiness probe checks the bucket at start-up, so a container that starts before
            // MinIO answers becomes unhealthy for no good reason.
            Compose().Should().MatchRegex(
                @"(?s)depends_on:.*?minio:.*?condition:\s*service_healthy",
                "the application must wait for MinIO's health check");
        }

        [Fact]
        public void Compose_ShouldBuildTheDevelopmentImage()
        {
            var compose = ComposeWithoutComments();

            compose.Should().Contain(
                "docker/Dockerfile.dev",
                "the stack runs a Development build of the application, not the release image");

            // The release image is Production and refuses to start without SMTP credentials
            // and a JWT secret. A stack built from it would run a different application than
            // the one under development.
            compose.Should().NotContain(
                "dockerfile: Dockerfile\n",
                "the release image is not the Development application");
        }

        [Fact]
        public void DevelopmentImage_ShouldBuildAsReleaseButStillTrackInsertedEntries()
        {
            // This is the bug that made the stack unusable the first time it ran.
            // GenericRepository.Insert only tracks the entity `#if DEBUG`; a Release build
            // makes it a no-op. The Development seeding is Insert-only, so under Release it
            // silently persists nothing and dies on the first save that references that
            // data - while every unit test and the in-memory store pass.
            var dockerfile = DevImage();

            dockerfile.Should().Contain(
                "-c Release",
                "the application must be built the way it is published");

            dockerfile.Should().Contain(
                "-p:DefineConstants=DEBUG",
                "a Release build without DEBUG turns GenericRepository.Insert into a no-op, "
                + "and the Development sample data is never persisted");
        }

        [Fact]
        public void DevelopmentImage_ShouldRunTheDevelopmentApplication()
        {
            DevImage().Should().Contain(
                "ASPNETCORE_ENVIRONMENT=Development",
                "the image serves the Development application");
        }

        [Fact]
        public void DevelopmentImage_ShouldServeTheDeployedBrowserBundleOnOneOrigin()
        {
            var dockerfile = DevImage();

            // Docker cannot share stages across Dockerfiles, so the client stage is repeated -
            // but it is the SAME command against the same lockfile, and the bundle goes to
            // wwwroot where the server serves it. What must not come back is a second server
            // owning the origin.
            dockerfile.Should().Contain(
                "ng build --configuration production",
                "the stack should serve the browser bundle the release image serves");

            dockerfile.Should().Contain(
                "/app/wwwroot/",
                "the SPA's own origin is the server's web root, or the browser cannot reach /api");

            DevImageInstructions().Should().NotContain(
                "nginx",
                "no proxy sits between the browser and Kestrel");
        }

        [Fact]
        public void DevelopmentImage_ShouldShipAFullTimeZoneDatabase()
        {
            // The clock decides which month "today" falls in, and the seeded and
            // browser-created data is dated relative to it. The plain Alpine runtime cannot
            // resolve its TZ (no zone database) and silently runs on UTC, so dates land in the
            // wrong month for part of every day in zones ahead of it. The -extra variant is
            // what carries the database, and the dev image has to use it too.
            DevImage().Should().Contain(
                "alpine-extra",
                "the Alpine runtime has no time-zone database, and the image is Alpine now");
        }

        [Fact]
        public void DevelopmentImage_ShouldListenOnThePortsTheComposeFilePublishes()
        {
            // Publishing a port the container does not listen on fails at request time
            // instead of at `up` time, which is much harder to diagnose. These two are
            // exactly the ports the compose file publishes. Both are bound by the same
            // Kestrel process: 4200 the SPA origin, 7003 the API's own port.
            var devImage = DevImage();

            devImage.Should().Contain(
                "ASPNETCORE_URLS=http://+:4200;http://+:7003",
                "Kestrel binds both published ports; nothing proxies to it any more");

            devImage.Should().Contain(
                "EXPOSE 4200 7003",
                "4200 is the SPA origin; 7003 is the API port compose publishes");

            devImage.Should().NotContain(
                "8081",
                "8081 was Kestrel's port behind nginx, which no longer exists");
        }

        [Fact]
        public void DevelopmentImage_ShouldNotCarryAnAttachmentsDirectory()
        {
            // There is no file-system provider to write into it any more, and the compose file
            // no longer mounts it. A VOLUME the application never touches only invites someone
            // to mount a volume that stores nothing.
            var dockerfile = DevImage();

            dockerfile.Should().NotContain(
                "/app/attachments",
                "attachments live in MinIO, not in the application container");

            dockerfile.Should().NotContain(
                "VOLUME",
                "no path in the application container holds state the application needs");
        }

        [Fact]
        public void Compose_ShouldNotMountAnAttachmentsVolume()
        {
            Compose().Should().NotContain(
                "attachments:",
                "a volume mounted where nothing is written is a misleading backup target");
        }

        [Fact]
        public void Compose_ShouldNotNeedTheReleaseImageConfiguration()
        {
            // The stack must list what it needs rather than inherit the release environment:
            // outside Development the application requires SMTP credentials, a JWT key and a
            // delete-token secret, none of which a local stack has.
            var compose = Compose();

            foreach (var productionOnly in new[] { "SMTP_HOST", "EconoFlow_TOKEN_SECRET_KEY" })
            {
                compose.Should().NotContain(
                    productionOnly,
                    $"{productionOnly} is only required outside Development, which is what "
                    + "this stack runs");
            }
        }
    }

    /// <summary>
    /// Guards the Cypress config the end-to-end suite is run with, on the host or in CI.
    ///
    /// <para>
    /// <c>cypress.config.ts</c> is TypeScript and compiled by Cypress itself, so it cannot
    /// be imported by this suite. These checks are textual, and deliberately so: they are
    /// about which knobs exist, not about their values.
    /// </para>
    /// </summary>
    public class CypressBaseUrlTests
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

        private static string CypressConfig() =>
            File.ReadAllText(Path.Combine(RepoRoot(), "easyfinance.client", "cypress.config.ts"));

        [Fact]
        public void CypressConfig_ShouldKeepTheDefaultBaseUrl()
        {
            // The dev stack publishes the SPA on the same port, so the default covers both
            // it and the `ng serve` proxy CI uses. CI runs `npx cypress run` with no
            // environment at all, so this default is load bearing.
            CypressConfig().Should().Contain(
                "'http://localhost:4200'",
                "the default must match the port the dev stack publishes and CI proxies");
        }

        [Fact]
        public void CypressConfig_ShouldHonourTheBaseUrlFromTheEnvironment()
        {
            // A developer who publishes the stack on another port must be able to point the
            // suite at it without editing - and committing - the config.
            var config = CypressConfig();

            config.Should().Contain(
                "baseUrl",
                "the suite needs a base URL");

            config.Should().Contain(
                "CYPRESS_BASE_URL",
                "an overridden published port has to reach the suite");

            config.Should().Contain(
                "|| 'http://localhost:4200'",
                "the default must apply only when no CYPRESS_BASE_URL is set");
        }
    }
}
