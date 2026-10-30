using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Server.Controllers;
using FpsSoftware.Chassis;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Moq;
using Shouldly;
using Xunit;

namespace EasyFinance.Server.Tests.Controllers
{
    /// <summary>
    /// Guards the HTTP contract of <c>GET api/Projects/{projectId}/year-summary/{year}</c>.
    /// The endpoint used to run its arithmetic on a nullable "last budgeted month" and to add
    /// the extrapolated budget to a value that was already a nullable, so the calculation only
    /// held together while the compiler inferred <see cref="int?"/> for the whole expression.
    /// These tests pin the zeroed summary for empty projects, the documented extrapolation rule
    /// and the populated totals.
    /// </summary>
    public class ProjectsYearSummaryTests
    {
        private readonly int year = 2024;
        private readonly Guid projectId = Guid.NewGuid();
        private readonly Mock<IProjectService> projectService = new();
        private readonly Mock<ICategoryService> categoryService = new();
        private readonly Mock<IIncomeService> incomeService = new();
        private readonly Mock<IAccessControlService> accessControlService = new();
        private readonly ProjectsController controller;

        public ProjectsYearSummaryTests()
        {
            var user = new UserBuilder().AddEmail("year-summary@econoflow.test").Build();

#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            var userManagerMock = new Mock<UserManager<User>>(
                new Mock<IUserStore<User>>().Object,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
#pragma warning restore CS8625 // Cannot convert null literal to non-nullable reference type.

            userManagerMock
                .Setup(manager => manager.GetUserAsync(It.IsAny<ClaimsPrincipal>()))
                .ReturnsAsync(user);

            this.controller = new ProjectsController(
                this.projectService.Object,
                this.categoryService.Object,
                this.incomeService.Object,
                this.accessControlService.Object,
                userManagerMock.Object)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new List<Claim>
                        {
                            new(ClaimTypes.NameIdentifier, user.Id.ToString())
                        }))
                    }
                }
            };
        }

        [Fact]
        public async Task Get_ProjectWithoutCategories_ShouldReturnZeroedSummary()
        {
            // Arrange: the whole summary is empty - no categories and no incomes.
            this.SetupServices(categories: [], incomes: []);

            // Act
            var summary = await this.GetYearSummaryAsync();

            // Assert
            summary.TotalBudget.ShouldBe(0m);
            summary.TotalSpend.ShouldBe(0m);
            summary.TotalOverspend.ShouldBe(0m);
            summary.TotalRemaining.ShouldBe(0m);
            summary.TotalEarned.ShouldBe(0m);
        }

        [Fact]
        public async Task Get_ProjectWithCategoriesButNoBudget_ShouldReturnZeroedBudgetTotals()
        {
            // Arrange: the reported case - expenses were recorded but no budget was ever set.
            // The last budgeted month is absent, so the budget is neither present nor
            // extrapolated, and every expense counts as overspent because nothing was planned.
            this.SetupServices(
                categories:
                [
                    Category("Housing", Expense(3, amount: 100m), Expense(4, amount: 50m)),
                    Category("Fun", Expense(7, amount: 25m))
                ],
                incomes: []);

            // Act
            var summary = await this.GetYearSummaryAsync();

            // Assert: TotalSpend is net of the overspend, so the clients that add TotalOverspend
            // back (annual-overview.component.ts) recover the gross 175 spent.
            summary.TotalBudget.ShouldBe(0m);
            summary.TotalSpend.ShouldBe(0m);
            summary.TotalOverspend.ShouldBe(175m);
            summary.TotalRemaining.ShouldBe(-175m);
            summary.TotalEarned.ShouldBe(0m);
        }

        [Fact]
        public async Task Get_YearWithoutTransactions_ShouldReturnZeroedSummary()
        {
            // Arrange: the services scope their queries by year, so a year the project has no
            // transaction in answers empty collections.
            this.SetupServices(categories: [], incomes: []);

            // Act
            var summary = await this.GetYearSummaryAsync();

            // Assert
            summary.TotalBudget.ShouldBe(0m);
            summary.TotalSpend.ShouldBe(0m);
            summary.TotalOverspend.ShouldBe(0m);
            summary.TotalRemaining.ShouldBe(0m);
            summary.TotalEarned.ShouldBe(0m);
            this.incomeService.Verify(service => service.GetAsync(this.projectId, this.year), Times.Once);
            this.categoryService.Verify(service => service.GetAsync(this.projectId, this.year), Times.Once);
        }

        [Fact]
        public async Task Get_ProjectWithOnlyIncomes_ShouldReturnIncomeTotalAndZeroedExpenseTotals()
        {
            // Arrange
            this.SetupServices(
                categories: [],
                incomes: [Income(1, 1000m), Income(2, 250.50m), Income(12, 99.50m)]);

            // Act
            var summary = await this.GetYearSummaryAsync();

            // Assert
            summary.TotalEarned.ShouldBe(1350m);
            summary.TotalBudget.ShouldBe(0m);
            summary.TotalSpend.ShouldBe(0m);
            summary.TotalOverspend.ShouldBe(0m);
            summary.TotalRemaining.ShouldBe(0m);
        }

        [Fact]
        public async Task Get_PopulatedProject_ShouldKeepTheExistingTotals()
        {
            // Arrange: two categories with budgets in January and March. The last budgeted
            // month is March, so the March budget is extrapolated across the 9 remaining
            // months, and the January budget counts once.
            this.SetupServices(
                categories:
                [
                    Category(
                        "Housing",
                        Expense(1, amount: 0m, budget: 1000),
                        Expense(3, amount: 400m, budget: 500)),
                    Category(
                        "Fun",
                        Expense(3, amount: 300m, budget: 200),
                        Expense(5, amount: 50m))
                ],
                incomes: [Income(6, 5000m)]);

            // Act
            var summary = await this.GetYearSummaryAsync();

            // Assert: the totals a populated project already returned - TotalSpend stays net of
            // the overspend, and TotalRemaining is measured against the gross spend.
            // TotalBudget: (1000 + 500 + 200) + 700 * 9 = 8000
            summary.TotalBudget.ShouldBe(8000m);
            // TotalOverspend: the 300 expense against its 200 budget and the 50 expense that has
            // no budget.
            summary.TotalOverspend.ShouldBe(150m);
            // TotalSpend: (0 + 400 + 300 + 50 gross) - 150 overspend = 600.
            summary.TotalSpend.ShouldBe(600m);
            summary.TotalRemaining.ShouldBe(8000m - 750m);
            summary.TotalEarned.ShouldBe(5000m);
        }

        [Fact]
        public async Task Get_PopulatedProject_ShouldReportSpendPlusOverspendAsTheGrossSpend()
        {
            // Arrange: the clients derive the gross spend as TotalSpend + TotalOverspend, so that
            // sum must always be the amount actually spent - also for expenses within budget.
            this.SetupServices(
                categories:
                [
                    Category(
                        "Housing",
                        Expense(2, amount: 100m, budget: 1000),
                        Expense(4, amount: 1200m, budget: 500)),
                    Category("Fun", Expense(9, amount: 0m, budget: 300))
                ],
                incomes: []);

            // Act
            var summary = await this.GetYearSummaryAsync();

            // Assert: gross spend is 100 + 1200 = 1300 and overspend is 700 (1200 against 500),
            // so TotalSpend is 600 and adding the overspend back recovers the gross spend.
            summary.TotalOverspend.ShouldBe(700m);
            summary.TotalSpend.ShouldBe(600m);
            summary.TotalSpend.ShouldBe(1300m - 700m);
            (summary.TotalSpend + summary.TotalOverspend).ShouldBe(1300m);
        }

        [Fact]
        public async Task Get_BudgetInTheLastMonthOfTheYear_ShouldNotExtrapolate()
        {
            // Arrange: the last budgeted month is December, so nothing is left to extrapolate.
            this.SetupServices(
                categories:
                [
                    Category(
                        "Housing",
                        Expense(1, amount: 100m, budget: 1000),
                        Expense(12, amount: 100m, budget: 1000))
                ],
                incomes: []);

            // Act
            var summary = await this.GetYearSummaryAsync();

            // Assert
            summary.TotalBudget.ShouldBe(2000m);
            summary.TotalSpend.ShouldBe(200m);
            summary.TotalOverspend.ShouldBe(0m);
            summary.TotalRemaining.ShouldBe(1800m);
        }

        [Fact]
        public async Task Get_ProjectWithoutCategories_ShouldNotThrow()
        {
            // Arrange: with no budgeted month the old code read the "last budgeted month" out of
            // an empty sequence, and the extrapolation arithmetic was only safe because the
            // compiler inferred int? for it. This pins that the call answers instead of throwing.
            this.SetupServices(categories: [], incomes: []);

            // Act
            var action = async () => await this.controller.Get(this.projectId, this.year);

            // Assert
            await Should.NotThrowAsync(action);
        }

        [Fact]
        public async Task Get_BudgetOfAnEarlierMonthOnly_ShouldExtrapolateFromJanuary()
        {
            // Arrange: a single budgeted month, January.
            this.SetupServices(
                categories: [Category("Housing", Expense(1, amount: 0m, budget: 100))],
                incomes: []);

            // Act
            var summary = await this.GetYearSummaryAsync();

            // Assert: 100 + 100 * (12 - 1)
            summary.TotalBudget.ShouldBe(1200m);
            summary.TotalRemaining.ShouldBe(1200m);
        }

        [Fact]
        public async Task Get_BudgetOnlyOfTheMostRecentMonth_ShouldExtrapolateOverEveryOtherMonth()
        {
            // Arrange: a single budgeted month - June.
            this.SetupServices(
                categories: [Category("Housing", Expense(6, amount: 0m, budget: 100))],
                incomes: []);

            // Act
            var summary = await this.GetYearSummaryAsync();

            // Assert: 100 + 100 * 6
            summary.TotalBudget.ShouldBe(700m);
            summary.TotalRemaining.ShouldBe(700m);
        }

        private void SetupServices(ICollection<CategoryResponseDTO> categories, ICollection<IncomeResponseDTO> incomes)
        {
            this.categoryService
                .Setup(service => service.GetAsync(this.projectId, this.year))
                .ReturnsAsync(AppResponse<ICollection<CategoryResponseDTO>>.Success(categories));

            this.incomeService
                .Setup(service => service.GetAsync(this.projectId, this.year))
                .ReturnsAsync(AppResponse<ICollection<IncomeResponseDTO>>.Success(incomes));
        }

        private async Task<YearSummary> GetYearSummaryAsync()
        {
            var result = await this.controller.Get(this.projectId, this.year);

            var statusCodeResult = result.ShouldBeAssignableTo<IStatusCodeActionResult>();
            statusCodeResult.StatusCode.ShouldBe(StatusCodes.Status200OK);

            // The endpoint answers an anonymous object, so the assertions read the serialized
            // body: its property names are the contract the Angular client relies on.
            var body = JsonSerializer.Serialize(result.ShouldBeAssignableTo<ObjectResult>().Value);

            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;

            return new YearSummary(
                root.GetProperty("TotalBudget").GetDecimal(),
                root.GetProperty("TotalSpend").GetDecimal(),
                root.GetProperty("TotalOverspend").GetDecimal(),
                root.GetProperty("TotalRemaining").GetDecimal(),
                root.GetProperty("TotalEarned").GetDecimal());
        }

        private static CategoryResponseDTO Category(string name, params ExpenseResponseDTO[] expenses) =>
            new()
            {
                Id = Guid.NewGuid(),
                Name = name,
                Expenses = expenses.ToList()
            };

        private ExpenseResponseDTO Expense(int month, decimal amount, int budget = 0) =>
            new()
            {
                Id = Guid.NewGuid(),
                Name = $"Expense {month}",
                Date = new DateOnly(this.year, month, 10),
                Amount = amount,
                Budget = budget,
                Items = []
            };

        private IncomeResponseDTO Income(int month, decimal amount) =>
            new()
            {
                Id = Guid.NewGuid(),
                Name = $"Income {month}",
                Date = new DateOnly(this.year, month, 10),
                Amount = amount
            };

        private sealed record YearSummary(
            decimal TotalBudget,
            decimal TotalSpend,
            decimal TotalOverspend,
            decimal TotalRemaining,
            decimal TotalEarned);
    }
}
