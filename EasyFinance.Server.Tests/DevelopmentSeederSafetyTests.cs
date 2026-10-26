using System;
using System.IO;
using System.Linq;
using EasyFinance.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards the rule that development seed data cannot reach a relational database.
    ///
    /// <para>
    /// <c>DevelopmentTestDataSeeder</c> inserts a fixed set of users, projects and
    /// expenses. It is development scaffolding, not application data, and running it
    /// against a real database either duplicates rows or fails outright.
    /// <c>DATETIME_KIND_TRAP.md</c> §2 records the guard CesarBarbosa uses
    /// (<c>if (!database.IsRelational || DevelopmentDataSeeder.IsForced)</c>) and
    /// recommends copying its shape.
    /// </para>
    ///
    /// <para>
    /// <b>This became reachable when provider selection moved from compile time to run
    /// time.</b> Under the old <c>#if DEBUG</c> branch a Debug build always received the
    /// in-memory store, so the seeder could never reach SQL Server. Now that the
    /// provider is resolved at run time, a developer running locally with
    /// <c>EasyFinanceDB</c> set gets a real PostgreSQL connection — and the seeder runs
    /// with it. Reproduced: the application failed at start-up with
    /// <c>"The value of 'IdentityUserRole&lt;Guid&gt;.UserId' is unknown when attempting to
    /// save changes"</c>, thrown from <c>DevelopmentTestDataSeeder.SeedAsync</c>.
    /// </para>
    ///
    /// <para>
    /// The seeder itself is exercised by <c>SeedDevelopmentData_WhenNotRelational</c>:
    /// the guard must not be so broad that it disables seeding for the in-memory store,
    /// which is the only place it should ever run.
    /// </para>
    /// </summary>
    public class DevelopmentSeederSafetyTests
    {
        [Fact]
        public void Seeder_ShouldDeclareItselfUnsafeForRelationalDatabases()
        {
            // The seeder must expose the decision as a value rather than hiding it in
            // Program.cs, so the rule is testable and cannot be lost in a refactor.
            var seederType = typeof(EasyFinance.Server.Config.DevelopmentTestDataSeeder);

            var method = seederType.GetMethod(
                "IsUnsafeFor",
                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);

            method.Should().NotBeNull(
                "DevelopmentTestDataSeeder must expose IsUnsafeFor(DatabaseProviderInfo) so "
                + "the 'never seed a real database' rule is assertable rather than implicit");

            method!.ReturnType.Should().Be(typeof(bool));
        }

        [Theory]
        [InlineData(DatabaseProvider.PostgreSql)]
        public void Seeder_ShouldRefuseARelationalDatabase(DatabaseProvider provider)
        {
            var info = new DatabaseProviderInfo(provider);

            var seederType = typeof(EasyFinance.Server.Config.DevelopmentTestDataSeeder);
            var method = seederType.GetMethod(
                "IsUnsafeFor",
                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)!;

            var unsafeFor = (bool)method.Invoke(null, new object[] { info })!;

            unsafeFor.Should().BeTrue(
                $"{provider} is a real database: seeding it duplicates development "
                + "fixtures over live rows, or fails outright");
        }

        [Fact]
        public void Seeder_ShouldAllowTheInMemoryStore()
        {
            var info = new DatabaseProviderInfo(DatabaseProvider.InMemory);

            var seederType = typeof(EasyFinance.Server.Config.DevelopmentTestDataSeeder);
            var method = seederType.GetMethod(
                "IsUnsafeFor",
                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)!;

            ((bool)method.Invoke(null, new object[] { info })!).Should().BeFalse(
                "the in-memory store is where the seeder is meant to run; a guard that "
                + "blocked it would remove the feature rather than protect the database");
        }

        /// <summary>
        /// The branch that runs Development against a real database.
        ///
        /// <para>
        /// The tests above pin the guard; this one pins the <i>wiring</i>. The guard was
        /// correct and still never ran for a PostgreSQL Development deployment, because
        /// <c>Program.cs</c> applies the migrations and creates the system roles only in
        /// the <c>else</c> of <c>if (IsDevelopment())</c>. Development therefore started
        /// against a schema-less database and failed on <c>relation "AspNetRoles" does not
        /// exist</c> — reproduced by running the application with
        /// <c>ASPNETCORE_ENVIRONMENT=Development</c> and <c>EasyFinanceDB</c> pointing at a
        /// fresh PostgreSQL.
        /// </para>
        ///
        /// <para>
        /// This is asserted against <c>Program.cs</c> rather than by starting the host: the
        /// ordering is the property under test, and a source assertion states it without
        /// standing up a web server and a database for every test run.
        /// </para>
        /// </summary>
        [Fact]
        public void Program_ShouldMigrateTheDatabaseInDevelopmentToo()
        {
            var program = File.ReadAllText(Path.Combine(RepoRoot(), "EasyFinance.Server", "Program.cs"));

            // Isolate the Development branch: everything between `if (IsDevelopment())`
            // and the `else` that follows it.
            var developmentFlag = program.IndexOf(
                "if (app.Environment.IsDevelopment())",
                StringComparison.Ordinal);

            developmentFlag.Should().BeGreaterThan(
                -1,
                "Program.cs is expected to branch on the environment");

            var developmentBranch = program.Substring(developmentFlag);

            var elseIndex = developmentBranch.IndexOf("\n    else", StringComparison.Ordinal);

            elseIndex.Should().BeGreaterThan(
                -1,
                "the Development branch is expected to be followed by an else");

            developmentBranch = developmentBranch.Substring(0, elseIndex);

            developmentBranch.Should().Contain(
                "UseMigration",
                "a Development deployment configured with EasyFinanceDB (Host=...) runs "
                + "DevelopmentTestDataSeeder, which itself insists it is skipped for a "
                + "relational store — so the schema has to be migrated there as well, or "
                + "start-up dies on a missing table");
        }

        /// <summary>
        /// The Cypress suite's premise.
        ///
        /// <para>
        /// Every spec except the three mocked auth ones signs in as
        /// <c>test@test.com</c> / <c>Passw0rd!</c> — the fixture user that only
        /// <c>DevelopmentTestDataSeeder</c> creates. Pointing Development at PostgreSQL
        /// therefore skips seeding and the suite can no longer authenticate, which is
        /// precisely the scenario this branch has to be tested in. The seeder must be
        /// re-enablable for a local database, explicitly and never for the in-memory store
        /// or in production.
        /// </para>
        /// </summary>
        [Fact]
        public void Seeder_ShouldBeExplicitlyOptInForALocalDatabase()
        {
            var program = File.ReadAllText(Path.Combine(RepoRoot(), "EasyFinance.Server", "Program.cs"));

            program.Should().Contain(
                "EconoFlow_SEED_DEVELOPMENT_DATA",
                "Development against Docker PostgreSQL skips the fixtures, so the Cypress "
                + "suite (which logs in as the seeded test@test.com) cannot run against the "
                + "only database the application has unless seeding can be requested "
                + "explicitly for a local database");
        }

        [Fact]
        public void Seeder_ShouldTrackTheEntitiesItInserts()
        {
            // THE BUG THAT MADE THE DOCKER STACK'S API USELESS.
            //
            // GenericRepository.Insert only calls Add() under `#if DEBUG`, so in a Release
            // build - which is what every image is - the repository "inserts" are no-ops. The
            // fixtures assume otherwise: the project, categories and user rows exist only if
            // the change tracker picked them up. Against the in-memory store the missing
            // principal was invisible (no foreign keys); against PostgreSQL the project was
            // never written, and the last line of the seeder - setting the user's default
            // project - failed with
            //   FK_AspNetUsers_Projects_DefaultProjectId
            // Program.cs catches that as a fatal start-up error and the process exits. The
            // container then restarts, seeds nothing again, and exits again, so the stack
            // answers 502 through its front door for as long as it is up.
            //
            // A seeder that builds a graph referencing entities it just created must not depend
            // on an `#if DEBUG` branch to make them exist.
            var seederPath = Path.Combine(
                RepoRoot(), "EasyFinance.Server", "Config", "DevelopmentTestDataSeeder.cs");

            var seeder = File.ReadAllText(seederPath);

            seeder.Should().NotContain(
                "Repository.Insert(",
                "the sample data is written through the change tracker, whose Add() is not "
                + "compiled out of Release builds");

            seeder.Should().Contain(
                "context.Add(",
                "the seeder reaches the change tracker through the database context directly");
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

        [Fact]
        public void AddPersistenceServices_ShouldAlwaysRegisterTheProviderInfoTheSeederNeeds()
        {
            // The guard reads DatabaseProviderInfo, so it must exist on every path -
            // including the in-memory one, where the seeder still runs.
            var services = new ServiceCollection();
            services.AddLogging();

            var configuration = new ConfigurationBuilder().AddInMemoryCollection([]).Build();
            services.AddPersistenceServices(configuration, providerOverride: DatabaseProvider.InMemory, isDevelopment: true);

            using var provider = services.BuildServiceProvider();

            provider.GetRequiredService<DatabaseProviderInfo>().Should().NotBeNull(
                "the seeder reads the resolved provider to decide whether it may run");
        }
    }
}
