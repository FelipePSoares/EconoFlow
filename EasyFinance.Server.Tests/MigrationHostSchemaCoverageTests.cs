using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using EasyFinance.Persistence.DatabaseContext;
using EconoFlow.DataMigration;
using FluentAssertions;
using FpsSoftware.DataMigration;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards that the migration host creates the schema for <b>both</b> contexts.
    ///
    /// <para>
    /// The engine migrates exactly one context per profile — <c>MigrationProfile</c>
    /// exposes a single <c>CreateContext</c> hook and nothing else. EconoFlow has two:
    /// <see cref="EasyFinanceDatabaseContext"/> and <see cref="MyKeysContext"/> (the
    /// Data Protection key ring).
    /// </para>
    ///
    /// <para>
    /// That gap is not theoretical. The first production cutover attempt ran
    /// <c>--migrate --truncate</c> and failed with:
    /// </para>
    ///
    /// <code>
    /// Schema: applying 1 migration(s): 20261012185544_InitialPostgresBaseline
    /// Schema: ready (1 migration(s) applied).
    /// MIGRATION FAILED: PostgresException: 42P01: relation "DataProtectionKeys" does not exist
    /// </code>
    ///
    /// <para>
    /// It applied the application context's migration, created 23 tables, and then died
    /// copying a table the plan maps but nothing had created. The rehearsal had masked
    /// it by applying both contexts by hand with <c>dotnet ef database update</c> —
    /// which is not what the tool does.
    /// </para>
    ///
    /// <para>
    /// <c>EasyFinance.Persistence.Postgres</c> carries a migration for each context
    /// under its own history table, so the requirement is that the host applies both.
    /// These tests pin that, and they run without a database.
    /// </para>
    /// </summary>
    public class MigrationHostSchemaCoverageTests
    {
        /// <summary>
        /// Every context that has a PostgreSQL migration and therefore must be applied
        /// before the copy runs.
        /// </summary>
        public static IEnumerable<object[]> ContextsWithPostgresMigrations =>
        [
            [typeof(EasyFinanceDatabaseContext)],
            [typeof(MyKeysContext)]
        ];

        private static IReadOnlyList<string> MigrationIdsFor(Type contextType)
            => typeof(EasyFinance.Persistence.Postgres.PostgresMigrations).Assembly
                .GetTypes()
                .Where(type => !type.IsAbstract && typeof(Migration).IsAssignableFrom(type))
                .Select(type => (
                    Id: type.GetCustomAttribute<MigrationAttribute>()?.Id,
                    Context: type.GetCustomAttribute<DbContextAttribute>()?.ContextType))
                .Where(entry => entry.Id != null && entry.Context == contextType)
                .Select(entry => entry.Id!)
                .ToList();

        [Theory]
        [MemberData(nameof(ContextsWithPostgresMigrations))]
        public void EveryMigratedContext_ShouldHaveAPostgresMigration(Type contextType)
        {
            MigrationIdsFor(contextType).Should().NotContain(
                (string?)null,
                $"{contextType.Name} must have a PostgreSQL migration to apply");

            MigrationIdsFor(contextType).Should().NotBeEmpty(
                $"{contextType.Name} is listed as a migrated context, so a migration "
                + "for it must exist in EasyFinance.Persistence.Postgres");
        }

        [Fact]
        public void Profile_ShouldApplyTheMyKeysSchema()
        {
            // The defect this guards against is a MISSING CALL. Asserting that the method
            // merely exists, or that its name appears somewhere, passes with the call
            // deleted - both mistakes were made while writing this test and caught by
            // mutation-testing it (delete the line, confirm red).
            //
            // So the assertion is on the STATEMENT: the exact invocation, with its
            // semicolon, inside CreateContext.
            var source = ReadProfileSource();

            var statement = "ApplyMyKeysSchema(context.Database.GetDbConnection().ConnectionString);";

            source.Should().Contain(
                statement,
                "CreateContext must APPLY the MyKeys migration; the engine migrates one "
                + "context only, so without this the copy fails with "
                + "'relation \"DataProtectionKeys\" does not exist'. Defining the method "
                + "and never calling it is the exact production failure this guards.");

            // And the call must be inside CreateContext, not merely present. Slice from
            // the declaration to the end of the method, then require the statement there.
            var methodStart = source.IndexOf("protected override DbContext CreateContext", StringComparison.Ordinal);

            methodStart.Should().BeGreaterThanOrEqualTo(
                0, "the profile must override CreateContext");

            var methodEnd = source.IndexOf("private static void ApplyMyKeysSchema", StringComparison.Ordinal);

            methodEnd.Should().BeGreaterThan(
                methodStart, "ApplyMyKeysSchema must be declared after CreateContext");

            source[methodStart..methodEnd].Should().Contain(
                "ApplyMyKeysSchema(",
                "the call must be made from CreateContext, so the schema is applied "
                + "whenever the engine builds its context");
        }

        /// <summary>
        /// The profile's source, located from the assembly rather than a hard-coded
        /// path so the test survives a move.
        /// </summary>
        private static string ReadProfileSource()
        {
            var assemblyDirectory = System.IO.Path.GetDirectoryName(
                typeof(EconoFlowMigrationProfile).Assembly.Location)!;

            var file = System.IO.Path.Combine(assemblyDirectory, "EconoFlowMigrationProfile.cs");

            if (System.IO.File.Exists(file))
                return System.IO.File.ReadAllText(file);

            // The .cs is not copied to the output directory, so walk up to the source
            // tree the same way the container tests do.
            var directory = new System.IO.DirectoryInfo(AppContext.BaseDirectory);

            while (directory != null)
            {
                if (System.IO.File.Exists(System.IO.Path.Combine(directory.FullName, "EasyFinance.sln")))
                {
                    return System.IO.File.ReadAllText(System.IO.Path.Combine(
                        directory.FullName, "tools", "EconoFlow.DataMigration", "EconoFlowMigrationProfile.cs"));
                }

                directory = directory.Parent;
            }

            throw new InvalidOperationException(
                $"Could not locate EconoFlowMigrationProfile.cs above '{AppContext.BaseDirectory}'.");
        }

        [Fact]
        public void ProfileSource_ShouldBeReadable()
        {
            // Guards the guard. The MyKeys assertion reads the profile's source, so if
            // that read ever silently returned an empty or wrong file, the assertion
            // would pass no matter what the profile said - a false negative, which is
            // worse than no test. Assert the read genuinely finds the file that defines
            // CreateContext.
            var source = ReadProfileSource();

            source.Should().NotBeNullOrWhiteSpace();
            source.Should().Contain("CreateContext", "the reader must be looking at the profile itself");
            source.Should().Contain("class EconoFlowMigrationProfile");
        }

        [Fact]
        public void Plan_ShouldCopyTheDataProtectionKeyRing_SoItsSchemaMustExist()
        {
            // Ties the two halves together: the plan copies DataProtectionKeys, so a
            // schema that does not create it is guaranteed to fail the copy. If the
            // table were ever dropped from the plan, the requirement to apply the
            // MyKeys migration would go with it - and this test would say so.
            MigrationPlan.Tables
                .Select(table => table.SourceTable)
                .Should().Contain(
                    "dbo.DataProtectionKeys",
                    "the key ring is copied, so its table must be created before the copy");
        }
    }
}
