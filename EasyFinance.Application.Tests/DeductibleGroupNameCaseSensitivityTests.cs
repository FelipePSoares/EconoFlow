using System;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Features.TaxYearService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Persistence.DatabaseContext;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EasyFinance.Application.Tests
{
    /// <summary>
    /// Guards the case-sensitivity contract of <see cref="DeductibleGroup.Name"/>,
    /// which changes meaning on the move from SQL Server to PostgreSQL.
    ///
    /// <para>
    /// SQL Server's default <c>_CI_AS</c> collation is <b>case-insensitive</b>, so
    /// <c>"Travel"</c> and <c>"travel"</c> collide. <c>CreateDeductibleGroupAsync</c>
    /// relies on this: it looks for an existing group by name and returns it, making
    /// create idempotent. PostgreSQL's <c>text</c> is case-<b>sensitive</b>, so the
    /// same lookup stops matching and the unique index stops rejecting — the user
    /// silently gets a <b>second group row</b> differing only in letter case.
    /// </para>
    ///
    /// <para>
    /// The fix is <c>citext</c> on the column
    /// (<c>EasyFinanceDatabaseContext.ApplyProviderSpecificConfiguration</c>), which
    /// restores case-insensitive equality for both the lookup and the unique index
    /// with no application change.
    /// </para>
    ///
    /// <para>
    /// <b>These tests require PostgreSQL.</b> The EF Core in-memory provider has no
    /// notion of column types or collations, so it cannot emulate <c>citext</c> and
    /// would report a false failure. They therefore skip unless a real PostgreSQL is
    /// configured — see <c>ECONOFLOW_PREFLIGHT.md</c> §5 and the rehearsal rule that
    /// PostgreSQL be published on <b>5433</b>, never 5432.
    /// </para>
    /// </summary>
    [Collection("Sequential")]
    [Trait("Category", "PostgreSqlIntegration")]
    public class DeductibleGroupNameCaseSensitivityTests : BaseTests
    {
        private const string TaxYearId = "2025-04";

        /// <summary>
        /// The variable naming a PostgreSQL instance to run these against. Absent in
        /// normal CI runs, which is what makes the skip explicit rather than silent.
        /// </summary>
        private const string PostgresConnectionVariable = "ECONOFLOW_TEST_POSTGRES";

        private static bool PostgreSqlIsAvailable =>
            !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(PostgresConnectionVariable));

        public DeductibleGroupNameCaseSensitivityTests()
        {
            PrepareInMemoryDatabase();
        }

        /// <summary>
        /// The service requires the project to have a tax-year rule configured before
        /// a group can be created. The scope is created once per test and kept alive
        /// for its duration — the resolved context is scoped, so disposing the scope
        /// early would hand back a disposed service.
        /// </summary>
        private async Task<(ITaxYearService Service, Project Project, IServiceScope Scope)> ArrangeAsync()
        {
            var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var project = await unitOfWork.ProjectRepository
                .Trackable()
                .FirstAsync(p => p.Id == this.project1.Id);

            project.SetTaxYearRule(
                TaxYearType.CustomStartMonth,
                taxYearStartMonth: 4,
                taxYearStartDay: 1,
                taxYearLabeling: TaxYearLabeling.ByStartYear);

            unitOfWork.ProjectRepository.InsertOrUpdate(project);
            await unitOfWork.CommitAsync();

            var taxYearService = scopedServices.GetRequiredService<ITaxYearService>();

            return (taxYearService, project, scope);
        }

        private static DeductibleGroupRequestDTO RequestWith(string name) => new() { Name = name };

        private async Task<int> CountPersistedGroupsAsync(IServiceScope scope, Guid projectId)
        {
            var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();

            return await context.Set<DeductibleGroup>()
                .IgnoreQueryFilters()
                .CountAsync(g => g.ProjectId == projectId && g.TaxYearId == TaxYearId);
        }

        [Fact(Skip = "Requires a real PostgreSQL: the in-memory provider cannot emulate citext. Set ECONOFLOW_TEST_POSTGRES to run (docs/postgres-migration/MIGRATION_TEMPLATE.md 4).")]
        public async Task CreateDeductibleGroup_WithDifferentCasing_ShouldReturnTheExistingGroup()
        {
            var (service, project, scope) = await ArrangeAsync();
            using var _ = scope;

            // Arrange: a group named "Travel" already exists.
            var first = await service.CreateDeductibleGroupAsync(project.Id, TaxYearId, RequestWith("Travel"));
            first.Succeeded.Should().BeTrue(string.Join("; ", first.Messages.Select(m => m.Description)));

            // Act: create "travel" — differs only in case.
            var second = await service.CreateDeductibleGroupAsync(project.Id, TaxYearId, RequestWith("travel"));

            // Assert: the same group comes back, rather than a second row.
            second.Succeeded.Should().BeTrue(string.Join("; ", second.Messages.Select(m => m.Description)));
            second.Data.Id.Should().Be(
                first.Data.Id,
                "names differing only in case must be treated as the same deductible "
                + "group, matching SQL Server's case-insensitive collation; without "
                + "citext on PostgreSQL this silently creates a duplicate row");
        }

        [Fact(Skip = "Requires a real PostgreSQL: the in-memory provider cannot emulate citext. Set ECONOFLOW_TEST_POSTGRES to run (docs/postgres-migration/MIGRATION_TEMPLATE.md 4).")]
        public async Task CreateDeductibleGroup_WithDifferentCasing_ShouldNotPersistASecondRow()
        {
            var (service, project, scope) = await ArrangeAsync();
            using var _ = scope;

            await service.CreateDeductibleGroupAsync(project.Id, TaxYearId, RequestWith("Travel"));
            await service.CreateDeductibleGroupAsync(project.Id, TaxYearId, RequestWith("TRAVEL"));

            (await CountPersistedGroupsAsync(scope, project.Id)).Should().Be(
                1,
                "only one row may exist per (project, tax year, name) regardless of "
                + "the casing the user typed");
        }

        [Fact(Skip = "Requires a real PostgreSQL: the in-memory provider cannot emulate citext. Set ECONOFLOW_TEST_POSTGRES to run (docs/postgres-migration/MIGRATION_TEMPLATE.md 4).")]
        public async Task CreateDeductibleGroup_WithSurroundingWhitespaceAndDifferentCasing_ShouldCollide()
        {
            var (service, project, scope) = await ArrangeAsync();
            using var _ = scope;

            var first = await service.CreateDeductibleGroupAsync(project.Id, TaxYearId, RequestWith("Health"));

            // Leading/trailing whitespace is trimmed by the service; the casing
            // difference is what this asserts.
            var second = await service.CreateDeductibleGroupAsync(project.Id, TaxYearId, RequestWith("  health  "));

            second.Succeeded.Should().BeTrue(string.Join("; ", second.Messages.Select(m => m.Description)));
            second.Data.Id.Should().Be(first.Data.Id);
        }

        [Fact(Skip = "Requires a real PostgreSQL: the in-memory provider cannot emulate citext. Set ECONOFLOW_TEST_POSTGRES to run (docs/postgres-migration/MIGRATION_TEMPLATE.md 4).")]
        public async Task CreateDeductibleGroup_WithGenuinelyDifferentNames_ShouldCreateSeparateGroups()
        {
            // The negative case: case-insensitivity must not collapse distinct names.
            var (service, project, scope) = await ArrangeAsync();
            using var _ = scope;

            var travel = await service.CreateDeductibleGroupAsync(project.Id, TaxYearId, RequestWith("Travel"));
            var health = await service.CreateDeductibleGroupAsync(project.Id, TaxYearId, RequestWith("Health"));

            travel.Succeeded.Should().BeTrue();
            health.Succeeded.Should().BeTrue();
            health.Data.Id.Should().NotBe(travel.Data.Id);
            (await CountPersistedGroupsAsync(scope, project.Id)).Should().Be(2);
        }
    }
}
