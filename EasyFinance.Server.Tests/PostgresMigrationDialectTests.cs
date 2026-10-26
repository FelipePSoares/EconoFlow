using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using EasyFinance.Persistence.DatabaseContext;
using FluentAssertions;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards that the <b>checked-in migration source</b> is PostgreSQL DDL.
    ///
    /// <para>
    /// Migrations are generated, not written, and the dialect they are generated in is
    /// decided by the design-time factory — not by the provider the application uses at
    /// runtime. Point that factory back at SQL Server and the generator happily emits
    /// <c>nvarchar</c>, <c>datetime2</c> and <c>SqlServer:Identity</c>, none of which run
    /// on PostgreSQL. The build still succeeds; the failure arrives when the migration is
    /// applied to a real database.
    /// </para>
    ///
    /// <para>
    /// This is the one guard that was lost when the two-migration-set project was
    /// consolidated — it lived in a test that also covered the deleted layout. It is
    /// cheap, it reads files rather than a database, and it covers a trap that only
    /// appears months later when someone adds a migration.
    /// </para>
    /// </summary>
    public class PostgresMigrationDialectTests
    {
        /// <summary>
        /// Markers that only ever appear in SQL Server DDL.
        ///
        /// <para>
        /// Deliberately narrow. Generated migrations carry BOTH the SQL type and the CLR
        /// type — <c>table.Column&lt;DateTimeOffset&gt;(type: "timestamp with time zone")</c>
        /// — so a marker matching the CLR name would fire on correct PostgreSQL output.
        /// <c>DateTimeOffset</c> was in this list at first and failed against the checked-in
        /// migrations for exactly that reason; the real column type was already correct.
        /// </para>
        ///
        /// <para>
        /// Each entry must be a string that cannot appear in valid PostgreSQL DDL. When in
        /// doubt, leave it out: a marker that false-positives gets the test deleted, which
        /// costs more than the narrow coverage would have gained.
        /// </para>
        /// </summary>
        private static readonly string[] SqlServerOnlyMarkers =
        [
            "nvarchar",
            "datetime2",
            "SqlServer:Identity",
            "SqlServer:ValueGenerationStrategy",
            "SqlServer:Include",
            "UseIdentityColumn",
            "NEWID()",
            "IDENTITY(1,1)",
            "uniqueidentifier",
            "type: \"datetime\"",
            "type: \"smalldatetime\"",
            "type: \"bit\""
        ];

        /// <summary>
        /// Marker that must be present, so a file that failed to read cannot pass the
        /// "contains no SQL Server DDL" assertion vacuously.
        /// </summary>
        private static readonly string[] PostgresMarkers =
        [
            "Npgsql"
        ];

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

        private static IReadOnlyList<string> MigrationFiles()
        {
            var persistence = Path.Combine(RepoRoot(), "EasyFinance.Persistence");

            return Directory.GetFiles(persistence, "*.cs", SearchOption.AllDirectories)
                .Where(path => path.Contains($"{Path.DirectorySeparatorChar}Migrations", StringComparison.Ordinal)
                               || path.Contains($"{Path.DirectorySeparatorChar}MigrationsMyKeys", StringComparison.Ordinal))
                .OrderBy(path => path, StringComparer.Ordinal)
                .ToList();
        }

        [Fact]
        public void EveryCheckedInMigration_ShouldContainNoSqlServerDdl()
        {
            var files = MigrationFiles();

            files.Should().NotBeEmpty(
                "the migrations live in EasyFinance.Persistence; finding none means this "
                + "test is looking in the wrong place and would pass vacuously");

            var offenders = new List<string>();

            foreach (var path in files)
            {
                var source = File.ReadAllText(path);

                offenders.AddRange(
                    SqlServerOnlyMarkers
                        .Where(marker => source.Contains(marker, StringComparison.OrdinalIgnoreCase))
                        .Select(marker => $"{Path.GetFileName(path)} contains '{marker}'"));
            }

            offenders.Should().BeEmpty(
                "a migration generated against SQL Server cannot be applied to PostgreSQL. "
                + "The design-time factory decides the dialect: "
                + "EasyFinanceDatabaseContextFactory and MyKeysDesignTimeDbContextFactory "
                + "must both use UseNpgsql. Offenders:\n" + string.Join("\n", offenders));
        }

        [Fact]
        public void EveryCheckedInMigration_ShouldActuallyBeAPostgresMigration()
        {
            // The self-check for the test above. "Contains no SQL Server markers" is
            // trivially true of an empty file, a mis-globbed path, or a README - so
            // require positive evidence that each file is a PostgreSQL migration.
            var files = MigrationFiles();

            files.Should().HaveCount(
                6,
                "two sets of three files: a migration, its Designer, and the context's "
                + "model snapshot for each context");

            foreach (var path in files)
            {
                var source = File.ReadAllText(path);

                PostgresMarkers.Any(marker => source.Contains(marker, StringComparison.Ordinal))
                    .Should().BeTrue(
                        $"{Path.GetFileName(path)} should reference Npgsql; without that it "
                        + "is not a PostgreSQL migration and the dialect guard above would "
                        + "pass for the wrong reason");
            }
        }

        [Fact]
        public void EveryMigration_ShouldDeclareTheContextThatOwnsIt()
        {
            // A migration with no [DbContext] is never applied by anything; one naming the
            // wrong context is applied by the wrong half of UseMigration().
            var migrations = typeof(EasyFinanceDatabaseContext).Assembly
                .GetTypes()
                .Where(type => !type.IsAbstract && typeof(Migration).IsAssignableFrom(type))
                .ToList();

            migrations.Should().HaveCount(2);

            foreach (var migration in migrations)
            {
                migration.GetCustomAttributes(typeof(DbContextAttribute), inherit: false)
                    .Should().NotBeEmpty(
                        $"{migration.Name} must declare [DbContext(...)]; EF discovers "
                        + "migrations through that attribute");
            }
        }
    }
}
