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
    /// Guards the two processes inside the image against each other's ports.
    ///
    /// <para>
    /// nginx is the container's front door and Kestrel runs behind it <i>in the same
    /// container</i>, so the API's loopback port must differ from the port nginx listens
    /// on. When the two defaults collided, both processes were started against 8080,
    /// nginx won the bind, and Kestrel died at start-up with
    /// <c>Failed to bind to address http://127.0.0.1:8080: address already in use</c> -
    /// a message that blames a port and says nothing about the real problem.
    /// </para>
    ///
    /// <para>
    /// The collision is invisible in review because each number looks reasonable on its
    /// own: 8080 is the app's public port, and 8080 is also the default application port.
    /// It is only visible by comparing the two defaults, which is what these tests do.
    /// </para>
    /// </summary>
    public class ContainerPortAllocationTests
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

        private static string Entrypoint() => Read("docker", "entrypoint.sh");

        private static string DevEntrypoint() => Read("docker", "dev-entrypoint.sh");

        /// <summary>
        /// The value a <c>NAME="${OVERRIDE:-fallback}"</c> assignment resolves to.
        /// </summary>
        private static int PortDefault(string script, string variable, string file)
        {
            var match = Regex.Match(
                script,
                $@"(?m)^\s*{Regex.Escape(variable)}=""\$\{{[A-Za-z_]+:-(\d+)\}}""");

            match.Success.Should().BeTrue(
                $"{file} must assign {variable} from an environment override with a default");

            return int.Parse(match.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
        }

        [Fact]
        public void TheApiAndNginx_ShouldNotShareAPortByDefault()
        {
            // With no operator override both defaults apply, so this is the arrangement
            // every deployment gets. Equal values mean the API can never start.
            var apiPort = PortDefault(Entrypoint(), "API_PORT", "docker/entrypoint.sh");
            var nginxPort = PortDefault(Entrypoint(), "NGINX_PORT", "docker/entrypoint.sh");

            apiPort.Should().NotBe(
                nginxPort,
                "nginx and Kestrel share one network namespace; on the same port the second "
                + "bind fails and the container exits before it can ever become ready");
        }

        [Fact]
        public void TheApi_ShouldBindTheLoopbackInterfaceOnAPortOfItsOwn()
        {
            var apiPort = PortDefault(Entrypoint(), "API_PORT", "docker/entrypoint.sh");

            // The exact lines, not a pattern: the port Kestrel binds and the port nginx
            // proxies to must come from the same variable, or an override creates a
            // mismatch in one place and not the other.
            Entrypoint().Should().Contain(
                "ASPNETCORE_URLS=\"http://127.0.0.1:${API_PORT}\"");

            Entrypoint().Should().Contain(
                "server 127.0.0.1:${API_PORT}");

            apiPort.Should().NotBe(
                8080,
                "8080 is nginx's public listen port; the API behind it needs a port of its own");
        }

        [Fact]
        public void Nginx_ShouldKeepListeningOnThePublishedPort()
        {
            // The image's published contract is 8080: the deployment repo's containerPort
            // and probes use it, and the docs' `docker run -p 8080:8080` relies on it. That
            // port is fixed, so the API is the side that moves when they would collide.
            PortDefault(Entrypoint(), "NGINX_PORT", "docker/entrypoint.sh")
                .Should().Be(8080, "8080 is the image's published port");

            Dockerfile().Should().Contain("EXPOSE 8080");
        }

        /// <summary>
        /// The healthcheck command line, narrowed to the line that carries the probe.
        /// </summary>
        private static string HealthcheckCommand(string dockerfile)
        {
            // The command may be split over lines with a trailing backslash, so search all
            // of the CMD / HEALTHCHECK text rather than a single trimmed line.
            var lines = dockerfile
                .Split('\n', StringSplitOptions.None)
                .Select(line => line.Trim())
                .Where(line => line.Contains("health/live", StringComparison.Ordinal)
                    || line.StartsWith("CMD", StringComparison.Ordinal));

            var command = string.Join(" ", lines);

            command.Should().NotBeEmpty("the image must declare a healthcheck that probes the API");

            return command;
        }

        [Fact]
        public void TheImageHealthcheck_ShouldProbeThePortNginxListensOn()
        {
            // Two failures are guarded here, and only the strong one survives an override:
            //
            //   * a probe on a port nginx does not listen on at all (the start-up bug seen
            //     one step later in the container's life), and
            //   * a probe that spells the default out, so ECONOFLOW_NGINX_PORT moves nginx
            //     and leaves the container reporting itself unhealthy while serving fine -
            //     a knob docs/docker.md advertises.
            var nginxPort = PortDefault(Entrypoint(), "NGINX_PORT", "docker/entrypoint.sh");
            var command = HealthcheckCommand(Dockerfile());

            // The strong property: the port is read from the environment, not typed in.
            var marker = "$" + "{ECONOFLOW_NGINX_PORT";

            command.Should().Contain(
                marker,
                "the probe must follow ECONOFLOW_NGINX_PORT; a typed-in port stops being right "
                + "the moment the entrypoint's default or an override changes it");

            nginxPort.Should().Be(
                8080,
                "the entrypoint's default is asserted here too, so a change to either side of "
                + "the contract is caught rather than only the difference between them");
        }

        [Fact]
        public void TheDevStack_ShouldKeepItsThreeListenersOnDistinctPorts()
        {
            // The Cypress stack runs three listeners in one container: nginx for the SPA,
            // nginx again for the API's own port, and Kestrel upstream of both. Any two
            // sharing a default is the same start-up failure this class guards.
            var spaPort = PortDefault(DevEntrypoint(), "SPA_PORT", "docker/dev-entrypoint.sh");
            var apiPort = PortDefault(DevEntrypoint(), "API_PORT", "docker/dev-entrypoint.sh");
            var upstreamPort = PortDefault(
                DevEntrypoint(), "API_UPSTREAM_PORT", "docker/dev-entrypoint.sh");

            new[] { spaPort, apiPort, upstreamPort }
                .Should().OnlyHaveUniqueItems(
                    "each listener binds its own socket in the same container");
        }

        [Fact]
        public void TheDevStack_ShouldWireEachVariableToItsOwnListener()
        {
            // Distinct defaults are not enough: swapping two of these variables keeps all
            // three unique while pointing Kestrel and nginx at each other's ports. Each
            // listener must name the variable that describes it.
            var dev = DevEntrypoint();

            dev.Should().Contain(
                "listen ${SPA_PORT}",
                "the SPA origin is the server block nginx serves the shell on");

            dev.Should().Contain(
                "listen ${API_PORT}",
                "the API's own server block is what tools reach on 7003");

            dev.Should().Contain(
                "ASPNETCORE_URLS=\"http://127.0.0.1:${API_UPSTREAM_PORT}\"",
                "Kestrel must bind the port nginx proxies to, not one of the listen ports");

            dev.Should().Contain(
                "server 127.0.0.1:${API_UPSTREAM_PORT}",
                "the upstream must be the port Kestrel actually binds");
        }

        [Fact]
        public void TheDevHealthchecks_ShouldProbePortsThatActuallyServe()
        {
            // The healthcheck is the other place the API's port is written down, in a
            // different file from the entrypoint. When it named the old 8080 it probed a
            // port nothing listens on, so the stack would have reported itself unhealthy
            // while serving requests normally.
            //
            // Both probes are pinned to their literal port as well as to the entrypoint's
            // value: an assertion that compares the file against the same variable it reads
            // the number from passes for ANY number, including one nothing binds. The literals
            // are what turn a dead port into a failure.
            var devEntrypoint = DevEntrypoint();
            var upstreamPort = PortDefault(devEntrypoint, "API_UPSTREAM_PORT", "docker/dev-entrypoint.sh");
            var spaPort = PortDefault(devEntrypoint, "SPA_PORT", "docker/dev-entrypoint.sh");

            foreach (var (file, contents) in new[]
            {
                ("docker/Dockerfile.dev", Read("docker", "Dockerfile.dev")),
                ("docker-compose.dev.yml", Read("docker-compose.dev.yml")),
            })
            {
                contents.Should().Contain(
                    $"${{ECONOFLOW_NGINX_PORT:-{spaPort}",
                    $"{file}: the SPA probe must follow ECONOFLOW_NGINX_PORT, so moving the "
                    + "SPA origin moves the probe with it");

                contents.Should().Contain(
                    $"127.0.0.1:{upstreamPort}/api/health/live",
                    $"{file}: the API probe must target Kestrel, which the entrypoint starts on "
                    + $"{upstreamPort}; a probe on any other port never answers");
            }

            // The two numbers the probes spell out must be the ones the entrypoint uses.
            // This is what catches the port moving in one file and not the other.
            upstreamPort.Should().Be(8081, "Kestrel's port in this stack");
            spaPort.Should().Be(4200, "the SPA origin in this stack");
        }

        [Fact]
        public void TheDevEntrypoint_ShouldRejectAnOverrideThatCollidesThePorts()
        {
            // The three-way analogue of the release-entrypoint guard. Without it, pointing
            // any two of the three variables at one port reproduces the original start-up
            // failure, and the operator sees only whichever process lost the bind.
            var devEntrypoint = DevEntrypoint();

            foreach (var (left, right) in new[]
            {
                ("SPA_PORT", "API_PORT"),
                ("SPA_PORT", "API_UPSTREAM_PORT"),
                ("API_PORT", "API_UPSTREAM_PORT"),
            })
            {
                devEntrypoint.Should().Contain(
                    $"${{{left}}}\" = \"${{{right}}}",
                    $"the {left} and {right} collision must be detected");
            }

            // The check must run before either process is started, or the failure it is
            // meant to explain has already happened.
            var guard = devEntrypoint.IndexOf("\"${SPA_PORT}\" = \"${API_PORT}\"", StringComparison.Ordinal);
            var apiStart = devEntrypoint.IndexOf("dotnet EasyFinance.Server.dll", StringComparison.Ordinal);
            var nginxStart = devEntrypoint.IndexOf(
                "nginx -c /usr/share/nginx/econoflow-main.conf", StringComparison.Ordinal);

            guard.Should().BeGreaterThan(-1);
            guard.Should().BeLessThan(apiStart, "the check must precede starting the API");
            guard.Should().BeLessThan(nginxStart, "the check must precede starting nginx");
        }

        [Fact]
        public void TheReleaseEntrypointGuard_ShouldBeTestedAgainstTheSameVariablesItUses()
        {
            // The release guard compares NGINX_PORT with API_PORT, so a collision set through
            // ECONOFLOW_NGINX_PORT / ECONOFLOW_API_PORT is caught at start-up. Assert that
            // the comparisons are on those two variables and no others: a guard that
            // compared, say, NGINX_PORT with itself would be vacuous.
            var entrypoint = Entrypoint();

            entrypoint.Should().Contain(
                "\"${NGINX_PORT}\" = \"${API_PORT}\"",
                "the guard must compare the two ports that are actually bound");

            PortDefault(entrypoint, "NGINX_PORT", "docker/entrypoint.sh")
                .Should().NotBe(PortDefault(entrypoint, "API_PORT", "docker/entrypoint.sh"));
        }

        [Fact]
        public void TheEntrypoint_ShouldRejectAnOverrideThatCollidesThePorts()
        {
            // Setting both variables to one value is the other way to reach the failure,
            // and the operator doing it cannot see the consequence: they are changing a
            // port, not removing a process. Refusing to start names the cause instead.
            var entrypoint = Entrypoint();

            entrypoint.Should().MatchRegex(
                @"if\s+\[\s*""\$\{NGINX_PORT\}""\s*=\s*""\$\{API_PORT\}""\s*\]",
                "the entrypoint must detect the collision before starting either process");

            // The check must run before the first service is launched, or the API has
            // already failed by the time it is made.
            var guard = entrypoint.IndexOf("${NGINX_PORT}\" = \"${API_PORT}", StringComparison.Ordinal);
            var apiStart = entrypoint.IndexOf("dotnet EasyFinance.Server.dll", StringComparison.Ordinal);
            var nginxStart = entrypoint.IndexOf(
                "nginx -c /usr/share/nginx/econoflow-main.conf", StringComparison.Ordinal);

            guard.Should().BeGreaterThan(-1);
            guard.Should().BeLessThan(apiStart, "the check must precede starting the API");
            guard.Should().BeLessThan(nginxStart, "the check must precede starting nginx");
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
