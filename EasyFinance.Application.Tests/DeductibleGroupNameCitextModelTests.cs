using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Persistence.DatabaseContext;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace EasyFinance.Application.Tests
{
    /// <summary>
    /// The half of the <c>citext</c> guarantee that needs no database.
    ///
    /// <para>
    /// <c>DeductibleGroups.Name</c> is user-supplied, compared for equality by
    /// <c>TaxYearService.CreateDeductibleGroupAsync</c>, and covered by a unique index.
    /// SQL Server's default <c>_CI_AS</c> collation made that comparison
    /// case-insensitive; PostgreSQL's <c>text</c> does not, so without <c>citext</c> the
    /// lookup stops matching and the unique index stops rejecting — the user silently
    /// gets a duplicate group differing only in letter case.
    /// </para>
    ///
    /// <para>
    /// These tests assert the <b>model configuration</b>: that Npgsql maps the column to
    /// <c>citext</c>, that the other providers do not, and that the extension is
    /// declared. They need no server, so they run in the pipeline like every other
    /// test — which matters, because the alternative is a guarantee nothing checks.
    /// </para>
    ///
    /// <para>
    /// The behavioural half — that a case-variant insert is genuinely rejected by a real
    /// PostgreSQL — lives in <c>DeductibleGroupNameCaseSensitivityPostgresTests</c>,
    /// because no provider without column types can emulate a collation.
    /// </para>
    /// </summary>
    public class DeductibleGroupNameCitextModelTests
    {
        private static EasyFinanceDatabaseContext CreateContext(DatabaseProvider provider)
        {
            var builder = new DbContextOptionsBuilder<EasyFinanceDatabaseContext>();

            switch (provider)
            {
                case DatabaseProvider.PostgreSql:
                    builder.UseNpgsql("Host=localhost;Port=5433;Database=model_only;Username=x;Password=x");
                    break;
                default:
                    builder.UseInMemoryDatabase("model_only");
                    break;
            }

            return new EasyFinanceDatabaseContext(builder.Options);
        }

        /// <summary>
        /// The <c>DeductibleGroups.Name</c> property, read from the <b>design-time</b>
        /// model.
        ///
        /// <para>
        /// The runtime model is read-optimised and deliberately omits relational store
        /// types and provider annotations, so reading it would make these tests assert
        /// nothing. <c>IDesignTimeModel</c> is the model the migrations are generated
        /// from, which is the thing under test.
        /// </para>
        /// </summary>
        private static IProperty NameProperty(EasyFinanceDatabaseContext context)
            => context.GetService<IDesignTimeModel>().Model
                .FindEntityType(typeof(DeductibleGroup))!
                .FindProperty(nameof(DeductibleGroup.Name))!;

        /// <summary>
        /// The column type, or <c>null</c> where the provider has no relational type
        /// mapping at all — <c>GetColumnType()</c> throws <c>InvalidCastException</c> on
        /// the in-memory provider, which is a fact about that provider rather than a
        /// defect in the model.
        /// </summary>
        private static string? NameColumnTypeFor(DatabaseProvider provider)
        {
            using var context = CreateContext(provider);

            return provider == DatabaseProvider.InMemory
                ? null
                : NameProperty(context).GetColumnType();
        }

        /// <summary>
        /// The <c>Npgsql:PostgresExtension:&lt;name&gt;</c> annotations on the design-time
        /// model.
        ///
        /// <para>
        /// The extension name lives in the annotation <b>key</b>, not the value — the
        /// generated migration shows <c>.Annotation("Npgsql:PostgresExtension:citext",
        /// ",,")</c>, where <c>",,"</c> is the (empty) schema and version. Matching on the
        /// value would therefore never find it.
        /// </para>
        /// </summary>
        private static IReadOnlyList<string> PostgresExtensionAnnotations(EasyFinanceDatabaseContext context)
            => context.GetService<IDesignTimeModel>().Model
                .GetAnnotations()
                .Where(a => a.Name.StartsWith("Npgsql:PostgresExtension", StringComparison.Ordinal))
                .Select(a => a.Name)
                .ToList();

        [Fact]
        public void Name_ShouldBeMappedToCitext_OnPostgreSql()
        {
            NameColumnTypeFor(DatabaseProvider.PostgreSql).Should().Be(
                "citext",
                "without citext the unique index stops rejecting case-variants, so "
                + "'Travel' and 'travel' become two rows");
        }

        [Fact]
        public void Name_ShouldConfigureCleanly_OnTheInMemoryProvider()
        {
            using var context = CreateContext(DatabaseProvider.InMemory);

            // The provider has no column types, so the meaningful assertion is that the
            // provider-specific guard did not throw while the model was being built.
            // Reaching this line at all proves the context was constructed successfully.
            var act = () => NameProperty(context);

            act.Should().NotThrow(
                "the Database.IsNpgsql() guard must skip the citext configuration "
                + "entirely on a provider that cannot express it");
        }

        [Fact]
        public void CitextExtension_ShouldBeDeclaredOnPostgreSql()
        {
            using var context = CreateContext(DatabaseProvider.PostgreSql);

            PostgresExtensionAnnotations(context).Should().Contain(
                annotation => annotation.Contains("citext", StringComparison.Ordinal),
                "the extension must be declared in the model so a database created by "
                + "the EF migrations alone is usable, without a hand-run init script");
        }

        [Fact]
        public void EveryDeclaredCaseInsensitiveColumn_ShouldActuallyBeConfigured()
        {
            // Closes the drift hazard: CaseInsensitiveTextColumns is the list the
            // configuration reads, but a list nothing verifies is still just a comment.
            // This asserts every entry really comes out mapped to citext on PostgreSQL,
            // so an entry that stopped having an effect fails here.
            using var postgres = CreateContext(DatabaseProvider.PostgreSql);

            var model = postgres.GetService<IDesignTimeModel>().Model;

            EasyFinanceDatabaseContext.CaseInsensitiveTextColumns.Should().NotBeEmpty(
                "the list is what ApplyProviderSpecificConfiguration iterates");

            foreach (var column in EasyFinanceDatabaseContext.CaseInsensitiveTextColumns)
            {
                var property = model.FindEntityType(column.Entity)?
                    .FindProperty(column.Property);

                property.Should().NotBeNull(
                    $"{column.Entity.Name}.{column.Property} is declared case-insensitive "
                    + "but is not a mapped property");

                property!.GetColumnType().Should().Be(
                    "citext",
                    $"{column.Entity.Name}.{column.Property} is declared case-insensitive "
                    + "but was not configured as citext, so the declaration does nothing");
            }
        }
    }
}
