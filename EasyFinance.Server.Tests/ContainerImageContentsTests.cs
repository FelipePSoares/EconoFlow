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
    /// These are not style checks. Both files encode facts that are invisible until a
    /// cutover, when they are expensive:
    /// </para>
    ///
    /// <list type="bullet">
    ///   <item>
    ///     The data-migration host must be <b>published into the application image</b>
    ///     at <c>/app/migrator</c>. If it is not, the cutover Job — which runs
    ///     <c>dotnet /app/migrator/EconoFlow.DataMigration.dll</c> — fails with
    ///     "file not found" at the worst possible moment.
    ///   </item>
    ///   <item>
    ///     It must ship in a stage based on <c>aspnet</c>, not <c>runtime</c>. The tool
    ///     references the persistence project, which transitively pulls in
    ///     <c>Microsoft.AspNetCore.Identity</c> and therefore needs the
    ///     <c>Microsoft.AspNetCore.App</c> shared framework. A <c>runtime</c> image
    ///     builds fine and the container dies at start-up.
    ///   </item>
    ///   <item>
    ///     The PostgreSQL migrations assembly must be present next to it, because the
    ///     profile loads it <b>by name</b> at run time. Nothing in the host's own code
    ///     names a type in it, so a plain project reference is not enough on its own.
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
        public void Dockerfile_ShouldPublishTheDataMigrationHost()
        {
            Dockerfile().Should().Contain(
                "tools/EconoFlow.DataMigration/EconoFlow.DataMigration.csproj",
                "the cutover runs the migrator from inside this image; if it is not "
                + "published, the Job fails with 'file not found'");
        }

        [Fact]
        public void Dockerfile_ShouldCopyTheMigratorIntoTheRuntimeImageAtAppMigrator()
        {
            var dockerfile = Dockerfile();

            // The copy into the runtime stage, to the path the Job and the
            // initContainer both use.
            dockerfile.Should().MatchRegex(
                @"COPY\s+--from=build\s+/migrator/?\s+\./migrator/?",
                "the migrator must land at /app/migrator, which is the path the "
                + "cutover Job invokes");
        }

        [Fact]
        public void Dockerfile_ShouldBaseTheMigratorRuntimeOnAspNet()
        {
            // A runtime image lacks Microsoft.AspNetCore.App, which the tool needs
            // transitively. This failure is invisible at build time and only appears
            // when the container starts.
            Dockerfile().Should().MatchRegex(
                @"FROM\s+mcr\.microsoft\.com/dotnet/aspnet:",
                "the tool needs the Microsoft.AspNetCore.App shared framework, so the "
                + "image that carries it must be the aspnet one");
        }

        [Fact]
        public void Dockerfile_ShouldCopyThePostgresMigrationsProject()
        {
            var dockerfile = Dockerfile();

            dockerfile.Should().Contain(
                "EasyFinance.Persistence.Postgres/EasyFinance.Persistence.Postgres.csproj",
                "the migrations project must be restored; without it the tool cannot "
                + "apply the PostgreSQL schema");

            dockerfile.Should().Contain(
                "COPY EasyFinance.Persistence.Postgres/ EasyFinance.Persistence.Postgres/",
                "the migrations project sources must be copied before publishing");
        }

        [Fact]
        public void ServerProject_ShouldReferenceThePostgresMigrationsAssembly()
        {
            // The application, not just the tool, needs this assembly at runtime:
            // PersistenceServiceRegistration names it as EF's MigrationsAssembly.
            //
            // Naming an assembly does not load it. EasyFinance.Server referenced only
            // EasyFinance.Persistence, so that .dll was never copied into the app's
            // output — the build succeeded and start-up then died with
            // 'FileNotFoundException: Could not load file or assembly
            // EasyFinance.Persistence.Postgres'. That reached production.
            var csproj = File.ReadAllText(
                Path.Combine(RepoRoot(), "EasyFinance.Server", "EasyFinance.Server.csproj"));

            csproj.Should().Contain(
                "EasyFinance.Persistence.Postgres.csproj",
                "the Server must reference the migrations project so the assembly lands "
                + "in the app's output; without it the app cannot start on PostgreSQL");
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
}
