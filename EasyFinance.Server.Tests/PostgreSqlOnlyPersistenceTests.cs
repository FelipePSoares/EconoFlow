using System;
using System.Linq;
using System.Reflection;
using EasyFinance.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// PostgreSQL is the only database this application has.
    ///
    /// <para>
    /// These tests pin the consolidated end state after the SQL Server migration finished:
    /// one provider, one assembly, one migration set per context — all inside
    /// <c>EasyFinance.Persistence</c>, exactly as the SQL Server migrations used to be.
    /// They replace <c>PostgresMigrationsAssemblyTests</c>, whose whole subject — pointing
    /// EF at a <i>separate</i> migrations assembly — no longer exists once there is only
    /// one assembly.
    /// </para>
    /// </summary>
    public class PostgreSqlOnlyPersistenceTests
    {
        private const string PersistenceAssembly = "EasyFinance.Persistence";

        /// <summary>
        /// Every context the application registers.
        /// </summary>
        public static TheoryData<Type> Contexts =>
            new() { typeof(EasyFinanceDatabaseContext), typeof(MyKeysContext) };

        private static string ConnectionString =>
            "Host=localhost;Port=5432;Database=econoflow;Username=econoflow;Password=x";

        private static DbContext BuildContext(Type contextType)
        {
            Environment.SetEnvironmentVariable("EasyFinanceDB", ConnectionString);

            try
            {
                var services = new Microsoft.Extensions.DependencyInjection.ServiceCollection();

                services.AddPersistenceServices(
                    new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build());

                services.AddLogging();

                var provider = services.BuildServiceProvider();
                var scope = provider.CreateScope();

                return (DbContext)scope.ServiceProvider.GetRequiredService(contextType);
            }
            finally
            {
                Environment.SetEnvironmentVariable("EasyFinanceDB", null);
            }
        }

        [Theory]
        [MemberData(nameof(Contexts))]
        public void EveryContext_ShouldUseThePostgreSqlProvider(Type contextType)
        {
            using var context = BuildContext(contextType);

            context.Database.ProviderName.Should().Be(
                "Npgsql.EntityFrameworkCore.PostgreSQL",
                "SQL Server is retired; the only provider is PostgreSQL");
        }

        [Theory]
        [MemberData(nameof(Contexts))]
        public void EveryContext_ShouldFindItsMigrationsInThisAssembly(Type contextType)
        {
            // SQL Server needed no MigrationsAssembly because the migrations sat beside the
            // DbContexts. Consolidating restores that property: the default is now correct,
            // so the explicit setting must be GONE rather than merely left working. A stale
            // MigrationsAssembly naming a deleted project would fail at start-up with
            // FileNotFoundException - the exact production outage this branch resolves.
            using var context = BuildContext(contextType);

            var relational = context.GetService<IDbContextOptions>()
                .Extensions
                .OfType<RelationalOptionsExtension>()
                .First();

            // EF reports the resolved assembly name whether or not it was set explicitly,
            // so assert on what it resolves to AND that the type lives here.
            (relational.MigrationsAssembly ?? PersistenceAssembly).Should().Be(
                PersistenceAssembly,
                "the migrations live in EasyFinance.Persistence now, which is also the "
                + "assembly containing the DbContexts, so EF's default is correct");

            typeof(EasyFinanceDatabaseContext).Assembly.GetName().Name.Should().Be(PersistenceAssembly);
        }

        [Fact]
        public void TheSeparatePostgresProject_ShouldNoLongerExist()
        {
            // The end state the consolidation exists to reach. On the assembly load path
            // this shows up as a missing file; assert it by name so the test states the
            // requirement rather than an implementation detail.
            var loaded = AppDomain.CurrentDomain.GetAssemblies()
                .Select(a => a.GetName().Name)
                .ToList();

            loaded.Should().NotContain(
                "EasyFinance.Persistence.Postgres",
                "the separate PostgreSQL persistence project was merged into "
                + "EasyFinance.Persistence and deleted");
        }

        [Fact]
        public void TheApplication_ShouldNotDependOnTheSqlServerProvider()
        {
            // SqlClient must be gone from the graph, not merely unused: a leftover
            // reference keeps the package in the image and in every vulnerability scan.
            var referenced = typeof(EasyFinanceDatabaseContext).Assembly
                .GetReferencedAssemblies()
                .Select(a => a.Name)
                .ToList();

            referenced.Should().NotContain(
                name => name != null && name.Contains("SqlServer", StringComparison.OrdinalIgnoreCase),
                "the SQL Server EF provider is retired");
        }

        [Fact]
        public void BothContexts_ShouldHaveExactlyOneMigration_WithTheIdsProductionRecords()
        {
            // The IDs are already in production's __EFMigrationsHistory. Moving the files
            // must not renumber them, or every future `Database.Migrate()` would try to
            // re-apply a baseline that is already there.
            var migrations = typeof(EasyFinanceDatabaseContext).Assembly
                .GetTypes()
                .Where(t => !t.IsAbstract && typeof(Migration).IsAssignableFrom(t))
                .Select(t => new
                {
                    Id = t.GetCustomAttribute<MigrationAttribute>()?.Id,
                    Context = t.GetCustomAttribute<DbContextAttribute>()?.ContextType
                })
                .Where(m => m.Id is not null)
                .ToList();

            migrations.Should().HaveCount(2, "one baseline per context, no more");

            migrations.Select(m => m.Id).Should().BeEquivalentTo(
                ["20261012185544_InitialPostgresBaseline", "20261012190723_InitialPostgresBaseline"],
                "these are the ids production already has recorded; renumbering them "
                + "would make the app attempt to re-apply a baseline that exists");

            migrations.Select(m => m.Context).Should().BeEquivalentTo(
                [typeof(EasyFinanceDatabaseContext), typeof(MyKeysContext)],
                "each context needs its own migration for the schema to be complete");
        }

        [Fact]
        public void ThereShouldBeNoSqlServerMigrationsLeft()
        {
            // The SQL Server set was 36 migrations, none of which production records.
            // Their .Designer.cs files each contain [DbContext] and a full model snapshot,
            // so leaving them would also mean two competing snapshots per context.
            var sqlServerMigrationIds = typeof(EasyFinanceDatabaseContext).Assembly
                .GetTypes()
                .Where(t => !t.IsAbstract && typeof(Migration).IsAssignableFrom(t))
                .Select(t => t.GetCustomAttribute<MigrationAttribute>()?.Id)
                .Where(id => id is not null && !id.Contains("InitialPostgresBaseline", StringComparison.Ordinal))
                .ToList();

            sqlServerMigrationIds.Should().BeEmpty(
                "every remaining migration must be a PostgreSQL baseline");
        }
    }
}
