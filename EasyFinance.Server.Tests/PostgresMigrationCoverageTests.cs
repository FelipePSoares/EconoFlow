using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Persistence.Postgres;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;
namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards that <b>every</b> <c>DbContext</c> has a PostgreSQL migration set.
    ///
    /// <para>
    /// EconoFlow has two contexts — <see cref="EasyFinanceDatabaseContext"/> and
    /// <see cref="MyKeysContext"/> — and the migration engine migrates exactly one
    /// context per profile, so each needs its own migration set and its own history
    /// table. This is WhiteLabel's shape.
    /// </para>
    ///
    /// <para>
    /// The failure this prevents is subtle and would only surface at cutover:
    /// <c>UseMigration()</c> calls <c>Database.Migrate()</c> on both contexts. If
    /// <c>MyKeysContext</c> has no PostgreSQL migration, the call against a PostgreSQL
    /// database either finds nothing to apply — leaving Data Protection keys with no
    /// table, so the application cannot protect or unprotect its own auth cookies — or
    /// fails outright. Because keys are only persisted outside Development, this would
    /// not appear in local runs at all.
    /// </para>
    /// </summary>
    public class PostgresMigrationCoverageTests
    {
        /// <summary>
        /// Every context the application registers and migrates.
        /// </summary>
        public static IEnumerable<object[]> ApplicationContexts =>
        [
            [typeof(EasyFinanceDatabaseContext)],
            [typeof(MyKeysContext)]
        ];

        private static IReadOnlyList<string> MigrationIdsFor(Type contextType)
        {
            return typeof(PostgresDesignTimeDbContextFactory).Assembly
                .GetTypes()
                .Where(type => !type.IsAbstract && typeof(Migration).IsAssignableFrom(type))
                .Select(type => (MigrationId: type.GetCustomAttribute<MigrationAttribute>()?.Id, Context: type.GetCustomAttribute<DbContextAttribute>()?.ContextType))
                .Where(entry => entry.MigrationId != null && entry.Context == contextType)
                .Select(entry => entry.MigrationId!)
                .ToList();
        }

        [Theory]
        [MemberData(nameof(ApplicationContexts))]
        public void EveryContext_ShouldHaveAtLeastOnePostgresMigration(Type contextType)
        {
            var migrations = MigrationIdsFor(contextType);

            migrations.Should().NotBeEmpty(
                $"{contextType.Name} must have a PostgreSQL migration in the "
                + $"{PostgresMigrations.AssemblyName} assembly. Both contexts are migrated at "
                + "start-up, so a context without one leaves its tables missing on "
                + "PostgreSQL (or fails the migration step outright).");
        }

        [Theory]
        [MemberData(nameof(ApplicationContexts))]
        public void EveryPostgresMigration_ShouldUsePostgresDdlAndNotSqlServerDdl(Type contextType)
        {
            // The migration bodies are generated from the provider the design-time
            // factory selects. If a factory is ever pointed back at SQL Server, these
            // strings reappear and the migration silently becomes unrunnable.
            var offenders = new List<string>();

            foreach (var migrationId in MigrationIdsFor(contextType))
            {
                var migrationType = typeof(PostgresDesignTimeDbContextFactory).Assembly
                    .GetTypes()
                    .First(type => type.GetCustomAttribute<MigrationAttribute>()?.Id == migrationId);

                var sql = string.Join(
                    "\n",
                    migrationType.GetMethods(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)
                        .Where(method => method.DeclaringType == migrationType)
                        .Select(method => method.ToString()));

                // The bodies are IL, so this check reads the generated source instead.
                offenders.AddRange(CheckGeneratedSourceForSqlServerDdl(migrationId));
            }

            offenders.Should().BeEmpty(
                $"PostgreSQL migrations for {contextType.Name} must not contain SQL Server "
                + "DDL. Offending artifacts:\n" + string.Join("\n", offenders));
        }

        /// <summary>
        /// Reads the generated migration source and looks for SQL Server type names.
        /// Reading source rather than IL is deliberate: the strings that matter
        /// (<c>nvarchar</c>, <c>SqlServer:Identity</c>) are the ones the generator emits
        /// into the file, and a reviewer reads the same file.
        /// </summary>
        private static IEnumerable<string> CheckGeneratedSourceForSqlServerDdl(string migrationId)
        {
            var root = FindRepoRoot();
            var migrationsDirectory = System.IO.Path.Combine(
                root, "EasyFinance.Persistence.Postgres", "Migrations");

            if (!System.IO.Directory.Exists(migrationsDirectory))
                return [];

            var sqlServerMarkers = new[]
            {
                "nvarchar", "datetime2", "SqlServer:Identity", "NEWID()",
                "uniqueidentifier", "UseIdentityColumn"
            };

            return System.IO.Directory
                .EnumerateFiles(migrationsDirectory, $"{migrationId}.cs", System.IO.SearchOption.AllDirectories)
                .SelectMany(file => System.IO.File.ReadAllLines(file)
                    .Select((line, index) => (line, number: index + 1))
                    .Where(entry => sqlServerMarkers.Any(marker =>
                        entry.line.Contains(marker, StringComparison.OrdinalIgnoreCase)))
                    .Select(entry => $"{System.IO.Path.GetFileName(file)}:{entry.number}: {entry.line.Trim()}"));
        }

        [Fact]
        public void MyKeysContext_ShouldUseThePostgresMigrationsAssembly()
        {
            // Guards the assembly wiring itself. Without it EF discovers the SQL Server
            // MyKeys migration and reports the context as already migrated.
            var options = new DbContextOptionsBuilder<MyKeysContext>()
                .UseNpgsql(
                    "Host=localhost;Port=5433;Database=coverage_check;Username=test;Password=test",
                    npgsql => npgsql.MigrationsAssembly(PostgresMigrations.AssemblyName))
                .Options;

            using var context = new MyKeysContext(options);

            context.Database.ProviderName.Should().Contain("Npgsql");

            var migrationsAssembly = context.GetService<IMigrationsAssembly>();
            migrationsAssembly.Assembly.GetName().Name.Should().Be(
                PostgresMigrations.AssemblyName,
                "the PostgreSQL migration set lives in its own assembly, and the SQL "
                + "Server set must not be discovered instead");
        }

        private static string FindRepoRoot()
        {
            var directory = new System.IO.DirectoryInfo(AppContext.BaseDirectory);

            while (directory != null)
            {
                if (System.IO.File.Exists(System.IO.Path.Combine(directory.FullName, "EasyFinance.sln")))
                    return directory.FullName;

                directory = directory.Parent;
            }

            throw new InvalidOperationException(
                $"Could not locate the repository root above '{AppContext.BaseDirectory}'.");
        }
    }
}
