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
    ///     The publish workflow must keep <c>workflow_dispatch</c>, so an image can be
    ///     built from a branch without merging — and must not move <c>latest</c> when it
    ///     is, or a branch build becomes what the cluster deploys.
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
            Path.Combine(RepoRoot(), ".github", "workflows", "docker-publish.yml"));

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
