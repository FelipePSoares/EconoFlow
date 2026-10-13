using System;
using System.Linq;
using EasyFinance.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards that the <b>runtime</b> PostgreSQL registrations point EF at the PostgreSQL
    /// migration assembly.
    ///
    /// <para>
    /// EconoFlow keeps two migration sets in two assemblies: the SQL Server set in
    /// <c>EasyFinance.Persistence</c> — the assembly that happens to contain the
    /// <c>DbContext</c>s — and the PostgreSQL set in
    /// <c>EasyFinance.Persistence.Postgres</c>.
    /// </para>
    ///
    /// <para>
    /// With <c>MigrationsAssembly</c> unset, EF defaults to the assembly containing the
    /// <c>DbContext</c>, which is the SQL Server set. On PostgreSQL the application then
    /// compares its model against the wrong migrations and refuses to start:
    /// </para>
    ///
    /// <code>
    /// System.InvalidOperationException: An error was generated for warning
    /// 'Microsoft.EntityFrameworkCore.Migrations.PendingModelChangesWarning':
    /// The model for context 'EasyFinanceDatabaseContext' has pending changes.
    ///   at EasyFinance.Persistence.PersistenceServiceRegistration.UseMigration(...)
    /// </code>
    ///
    /// <para>
    /// That was a production outage. The design-time factories both set
    /// <c>MigrationsAssembly</c>, so <c>dotnet ef</c> and the data-migration tool were
    /// fine — which is exactly why rehearsal missed it. The application's own start-up
    /// path was the one path not covered, so this test covers it.
    /// </para>
    /// </summary>
    public class PostgresMigrationsAssemblyTests
    {
        private const string PostgresMigrationsAssembly = "EasyFinance.Persistence.Postgres";

        private const string PostgresConnectionString =
            "Host=localhost;Port=5432;Database=econoflow;Username=econoflow;Password=x";

        /// <summary>
        /// Resolves the contexts exactly as the application does — through
        /// <c>AddPersistenceServices</c> — and returns the migration assembly EF was
        /// configured with for each.
        /// </summary>
        private static (string Assembly, string ProviderName)[] MigrationsAssemblyForBothContexts()
        {
            Environment.SetEnvironmentVariable("EasyFinanceDB", PostgresConnectionString);

            try
            {
                var services = new ServiceCollection();

                services.AddPersistenceServices(
                    new ConfigurationBuilder().Build(),
                    providerOverride: DatabaseProvider.PostgreSql);

                services.AddLogging();

                using var provider = services.BuildServiceProvider();
                using var scope = provider.CreateScope();

                return
                [
                    ReadMigrationAssembly(scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>()),
                    ReadMigrationAssembly(scope.ServiceProvider.GetRequiredService<MyKeysContext>())
                ];
            }
            finally
            {
                Environment.SetEnvironmentVariable("EasyFinanceDB", null);
            }
        }

        private static (string Assembly, string ProviderName) ReadMigrationAssembly(DbContext context)
        {
            var relational = context.GetService<IDbContextOptions>()
                .Extensions
                .OfType<RelationalOptionsExtension>()
                .First();

            return (relational.MigrationsAssembly ?? "(default)", context.Database.ProviderName ?? "(none)");
        }

        [Fact]
        public void EveryContext_ShouldUseThePostgresMigrationsAssembly_WhenTheProviderIsPostgreSql()
        {
            foreach (var (assembly, providerName) in MigrationsAssemblyForBothContexts())
            {
                providerName.Should().Be(
                    "Npgsql.EntityFrameworkCore.PostgreSQL",
                    "the PostgreSQL provider must be selected");

                assembly.Should().Be(
                    PostgresMigrationsAssembly,
                    "without MigrationsAssembly EF looks in the assembly that contains the "
                    + "DbContext — the SQL Server migration set — and the application then "
                    + "fails to start on PostgreSQL with PendingModelChangesWarning");
            }
        }

        [Fact]
        public void ThePostgresMigrationsAssembly_ShouldActuallyExistAndHoldMigrations()
        {
            // Guards against the name being right but pointing at nothing, which would
            // fail at start-up instead of here.
            var assembly = AppDomain.CurrentDomain.GetAssemblies()
                .FirstOrDefault(a => a.GetName().Name == PostgresMigrationsAssembly)
                ?? System.Reflection.Assembly.Load(PostgresMigrationsAssembly);

            var migrations = assembly.GetTypes()
                .Where(type => !type.IsAbstract
                               && typeof(Microsoft.EntityFrameworkCore.Migrations.Migration)
                                   .IsAssignableFrom(type))
                .ToList();

            migrations.Should().HaveCount(
                2,
                "one migration per context: EasyFinanceDatabaseContext and MyKeysContext. "
                + "A missing set means one context's schema is never created, which is how "
                + "the copy failed with 'relation \"DataProtectionKeys\" does not exist'");
        }
    }
}
