using System;
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
        [InlineData(DatabaseProvider.SqlServer)]
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
