using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Persistence.DatabaseContext;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards raw SQL fragments in the EF model against SQL Server-only syntax.
    ///
    /// <para>
    /// EF Core stores index <c>HasFilter(...)</c> strings and
    /// <c>HasCheckConstraint(...)</c> bodies as <b>raw SQL</b> — it does not translate
    /// them. The pre-flight audit looked for raw SQL in C# call sites
    /// (<c>FromSqlRaw</c>, <c>ExecuteSqlRaw</c>) and correctly found none, but it
    /// missed these, because they are SQL strings passed as model configuration.
    /// </para>
    ///
    /// <para>
    /// They were caught by the rehearsal, not by inspection: applying the generated
    /// PostgreSQL baseline failed with
    /// <c>42601: syntax error at or near "["</c>, because SQL Server's bracket
    /// identifier quoting (<c>[ExpenseId]</c>) and its <c>bit</c> literal comparison
    /// (<c>IsArchived = 0</c>) are not valid PostgreSQL.
    /// </para>
    ///
    /// <para>
    /// This is the "each one is a rewrite, not a port" category from
    /// <c>MIGRATION_TEMPLATE.md</c> §2. The strings must be written in syntax both
    /// providers accept — double quotes are valid on both — or branched per provider.
    /// </para>
    /// </summary>
    public class RawSqlProviderPortabilityTests
    {
        private static EasyFinanceDatabaseContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<EasyFinanceDatabaseContext>()
                .UseInMemoryDatabase($"RawSql_{Guid.NewGuid():N}")
                .Options;

            return new EasyFinanceDatabaseContext(options);
        }

        /// <summary>
        /// Every raw SQL fragment in the model: index filters and check constraints.
        /// </summary>
        /// <remarks>
        /// Reads the <b>design-time</b> model. The runtime model is read-optimized and
        /// deliberately does not carry check-constraint SQL, so reading it throws
        /// "The requested configuration is not stored in the read-optimized model".
        /// </remarks>
        private static IEnumerable<(string Where, string Sql)> EnumerateRawSqlFragments()
        {
            using var context = CreateContext();
            var model = context.GetService<IDesignTimeModel>().Model;

            foreach (var entityType in model.GetEntityTypes())
            {
                var tableName = entityType.GetTableName();

                foreach (var index in entityType.GetIndexes())
                {
                    var filter = index.GetFilter();
                    if (!string.IsNullOrWhiteSpace(filter))
                        yield return ($"index on {tableName}", filter);
                }

                foreach (var constraint in entityType.GetCheckConstraints())
                {
                    if (!string.IsNullOrWhiteSpace(constraint.Sql))
                        yield return ($"check constraint {constraint.Name} on {tableName}", constraint.Sql);
                }
            }
        }

        [Fact]
        public void RawSqlFragments_ShouldNotUseSqlServerBracketQuoting()
        {
            // PostgreSQL rejects [Identifier] outright: syntax error at or near "[".
            var offences = EnumerateRawSqlFragments()
                .Where(fragment => fragment.Sql.Contains('[', StringComparison.Ordinal)
                    || fragment.Sql.Contains(']', StringComparison.Ordinal))
                .Select(fragment => $"{fragment.Where}: {fragment.Sql}")
                .ToList();

            offences.Should().BeEmpty(
                "raw SQL fragments are not translated by EF Core, so bracket identifier "
                + "quoting fails on PostgreSQL with 'syntax error at or near \"[\"'. "
                + "Use double-quoted identifiers, which both providers accept ("
                + "docs/postgres-migration/MIGRATION_TEMPLATE.md §4). Offending fragments:\n"
                + string.Join("\n", offences));
        }

        /// <summary>
        /// Columns whose CLR type is <see cref="bool"/> and therefore become
        /// PostgreSQL <c>boolean</c>, where an integer comparison is invalid.
        /// Enum columns are deliberately NOT included: they are stored as integers on
        /// both providers, so <c>= 1</c> is portable and must not be flagged.
        /// </summary>
        private static HashSet<string> BooleanColumnNames()
        {
            using var context = CreateContext();
            var model = context.GetService<IDesignTimeModel>().Model;

            return model.GetEntityTypes()
                .SelectMany(entityType => entityType.GetProperties())
                .Where(property => (Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType) == typeof(bool))
                .Select(property => property.GetColumnName())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        [Fact]
        public void RawSqlFragments_ShouldNotCompareBooleanColumnsToIntegers()
        {
            // SQL Server's `bit` accepts `= 0` / `= 1`. PostgreSQL's `boolean` does not:
            // `IsArchived = 0` is 'operator does not exist: boolean = integer'.
            //
            // Only *boolean* columns are checked. An enum column is stored as an
            // integer on both providers, so `"AttachmentType" = 1` is portable and
            // flagging it would be a false positive.
            var booleanColumns = BooleanColumnNames();
            var offenders = new List<string>();

            foreach (var fragment in EnumerateRawSqlFragments())
            {
                foreach (var column in booleanColumns)
                {
                    // Tolerates a quoted or bare identifier and requires the column to
                    // be compared to a bare 0 or 1.
                    var escapedColumn = System.Text.RegularExpressions.Regex.Escape(column);
                    var pattern = "(?:\"|\\[|^|\\s)" + escapedColumn + "(?:\"|\\]|$|\\s)*=\\s*[01](?!\\d)";

                    if (System.Text.RegularExpressions.Regex.IsMatch(fragment.Sql, pattern))
                        offenders.Add($"{fragment.Where}: {fragment.Sql}");
                }
            }

            offenders.Should().BeEmpty(
                "a boolean column compared to 0/1 works on SQL Server's bit type but "
                + "fails on PostgreSQL with 'operator does not exist: boolean = integer'. "
                + "Use FALSE/TRUE. Offending fragments:\n"
                + string.Join("\n", offenders));
        }

        [Fact]
        public void RawSqlFragments_ShouldStillExist()
        {
            // Guards the guard: if the fragments were silently dropped from the model,
            // the two tests above would pass vacuously and prove nothing. There are
            // five today (3 index filters + 1 index filter + 1 check constraint).
            var fragments = EnumerateRawSqlFragments().ToList();

            fragments.Should().NotBeEmpty(
                "the model is expected to carry raw SQL filters and a check constraint; "
                + "if this is empty the portability checks above are vacuous");

            fragments.Count.Should().BeGreaterThanOrEqualTo(
                4,
                "five raw SQL fragments were present when this test was written");
        }
    }
}
