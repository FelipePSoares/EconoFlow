using System;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Features.TaxYearService;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Persistence.Repositories;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EasyFinance.Application.Tests
{
    /// <summary>
    /// The behavioural half of the <c>citext</c> guarantee for
    /// <see cref="DeductibleGroup.Name"/>: that a case-variant really is rejected by a
    /// real PostgreSQL, not merely that the column is declared <c>citext</c>.
    ///
    /// <para>
    /// <c>CreateDeductibleGroupAsync</c> looks an existing group up by name and returns
    /// it, which is what makes create idempotent. SQL Server's <c>_CI_AS</c> collation
    /// made that lookup case-insensitive; PostgreSQL's <c>text</c> is case-sensitive, so
    /// without <c>citext</c> the lookup stops matching <b>and</b> the unique index stops
    /// rejecting — the user silently gets a second group differing only in letter case.
    /// </para>
    ///
    /// <para>
    /// <b>Self-contained on purpose.</b> These tests do <b>not</b> inherit
    /// <c>BaseTests</c>. That fixture exists to exercise business logic on the in-memory
    /// provider, where every run gets its own uniquely-named database and tests can run
    /// in parallel. Pointing it at a shared PostgreSQL would make hundreds of unrelated
    /// tests race each other's <c>EnsureDeleted</c>, and the pipeline has no PostgreSQL
    /// to give it anyway. A test that needs a specific provider owns its own context —
    /// the same shape <c>DataProtectionKeyRingTests</c> uses.
    /// </para>
    ///
    /// <para>
    /// Set <c>ECONOFLOW_TEST_POSTGRES</c> to run them. Without it they return early and
    /// are reported as passed, so the default pipeline is unaffected. The rehearsal
    /// PostgreSQL is published on <b>5433</b>, never 5432 — on a workstation 5432 is
    /// often a port-forward that reaches production.
    /// </para>
    /// </summary>
    [Trait("Category", "PostgreSqlIntegration")]
    [Collection("Sequential")]
    public class DeductibleGroupNameCaseSensitivityPostgresTests : IDisposable
    {
        private const string PostgresConnectionVariable = "ECONOFLOW_TEST_POSTGRES";
        private const string TaxYearId = "2025-04";

        private readonly ServiceProvider? serviceProvider;
        private readonly Guid projectId;

        private static bool PostgreSqlIsAvailable =>
            !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(PostgresConnectionVariable));

        public DeductibleGroupNameCaseSensitivityPostgresTests()
        {
            if (!PostgreSqlIsAvailable)
                return;

            var connectionString = Environment.GetEnvironmentVariable(PostgresConnectionVariable)!;

            var services = new ServiceCollection();

            services.AddDbContext<EasyFinanceDatabaseContext>(options =>
                options.UseNpgsql(connectionString, npgsql => npgsql
                    .MigrationsAssembly("EasyFinance.Persistence.Postgres")));

            services.AddScoped<IUnitOfWork, UnitOfWork>();
            services.AddScoped<ITaxYearService, TaxYearService>();
            services.AddLogging();
            services.AddIdentityCore<User>().AddEntityFrameworkStores<EasyFinanceDatabaseContext>();

            serviceProvider = services.BuildServiceProvider();

            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();

            // The real schema, applied by the PostgreSQL migration set. EnsureCreated()
            // must NOT be used: it builds the model directly and skips migrations, so
            // the citext extension declared inside one would never be installed and the
            // schema would differ from production in exactly the way under test.
            context.Database.EnsureDeleted();
            context.Database.Migrate();

            projectId = SeedProject(scope.ServiceProvider);
        }

        /// <summary>
        /// A minimal project with a configured tax-year rule — the only precondition
        /// <c>CreateDeductibleGroupAsync</c> imposes.
        ///
        /// <para>
        /// Built with the project's builders rather than constructed directly, per the
        /// testing conventions in AGENTS.md.
        /// </para>
        /// </summary>
        private static Guid SeedProject(IServiceProvider scopedServices)
        {
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var owner = new UserBuilder()
                .AddFirstName("Citext")
                .AddLastName("Owner")
                .AddEmail("citext.owner@example.test")
                .Build();

            var project = new ProjectBuilder()
                .AddName("Citext Project")
                .AddTaxYearRule(
                    TaxYearType.CustomStartMonth,
                    taxYearStartMonth: 4,
                    taxYearStartDay: 1,
                    taxYearLabeling: TaxYearLabeling.ByStartYear)
                .Build();

            unitOfWork.ProjectRepository.InsertOrUpdate(project);
            unitOfWork.CommitAsync().GetAwaiter().GetResult();

            return project.Id;
        }

        public void Dispose()
        {
            serviceProvider?.Dispose();
            GC.SuppressFinalize(this);
        }

        private ITaxYearService CreateService() =>
            serviceProvider!.CreateScope().ServiceProvider.GetRequiredService<ITaxYearService>();

        private async Task<int> CountGroupsAsync()
        {
            using var scope = serviceProvider!.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();

            return await context.Set<DeductibleGroup>()
                .IgnoreQueryFilters()
                .CountAsync(g => g.ProjectId == projectId && g.TaxYearId == TaxYearId);
        }

        private static DeductibleGroupRequestDTO RequestWith(string name) => new() { Name = name };

        [Fact]
        public async Task CreateDeductibleGroup_WithDifferentCasing_ShouldReturnTheExistingGroup()
        {
            if (!PostgreSqlIsAvailable) return; // see the class summary

            var service = CreateService();

            var first = await service.CreateDeductibleGroupAsync(projectId, TaxYearId, RequestWith("Travel"));
            first.Succeeded.Should().BeTrue(string.Join("; ", first.Messages.Select(m => m.Description)));

            var second = await service.CreateDeductibleGroupAsync(projectId, TaxYearId, RequestWith("travel"));

            second.Succeeded.Should().BeTrue(string.Join("; ", second.Messages.Select(m => m.Description)));
            second.Data.Id.Should().Be(
                first.Data.Id,
                "names differing only in case must be the same group, matching SQL "
                + "Server's case-insensitive collation");
        }

        [Fact]
        public async Task CreateDeductibleGroup_WithDifferentCasing_ShouldNotPersistASecondRow()
        {
            if (!PostgreSqlIsAvailable) return;

            var service = CreateService();

            await service.CreateDeductibleGroupAsync(projectId, TaxYearId, RequestWith("TRAVEL"));

            (await CountGroupsAsync()).Should().Be(
                1,
                "only one row may exist per (project, tax year, name) regardless of the "
                + "casing the user typed");
        }

        [Fact]
        public async Task CreateDeductibleGroup_WithWhitespaceAndDifferentCasing_ShouldCollide()
        {
            if (!PostgreSqlIsAvailable) return;

            var service = CreateService();

            var first = await service.CreateDeductibleGroupAsync(projectId, TaxYearId, RequestWith("Health"));

            // Leading/trailing whitespace is trimmed by the service; the casing
            // difference is what this asserts.
            var second = await service.CreateDeductibleGroupAsync(projectId, TaxYearId, RequestWith("  health  "));

            second.Succeeded.Should().BeTrue(string.Join("; ", second.Messages.Select(m => m.Description)));
            second.Data.Id.Should().Be(first.Data.Id);
        }

        [Fact]
        public async Task CreateDeductibleGroup_WithGenuinelyDifferentNames_ShouldCreateSeparateGroups()
        {
            if (!PostgreSqlIsAvailable) return;

            var service = CreateService();

            var travel = await service.CreateDeductibleGroupAsync(projectId, TaxYearId, RequestWith("Travel"));
            var health = await service.CreateDeductibleGroupAsync(projectId, TaxYearId, RequestWith("Health"));

            travel.Succeeded.Should().BeTrue();
            health.Succeeded.Should().BeTrue();
            health.Data.Id.Should().NotBe(
                travel.Data.Id,
                "case-insensitivity must not collapse genuinely distinct names");
            (await CountGroupsAsync()).Should().Be(2);
        }
    }
}
