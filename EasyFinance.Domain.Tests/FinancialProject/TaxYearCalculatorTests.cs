using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Domain.FinancialProject;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.FinancialProject
{
    public class TaxYearCalculatorTests
    {
        [Fact]
        public void GetPeriod_CalendarYear_ShouldUseDateYear()
        {
            var project = new ProjectBuilder()
                .AddTaxYearRule(TaxYearType.CalendarYear)
                .Build();

            var period = TaxYearCalculator.GetPeriod(project, new DateOnly(2026, 3, 4));

            period.TaxYearId.Should().Be("2026");
            period.Label.Should().Be("2026");
            period.StartDate.Should().Be(new DateOnly(2026, 1, 1));
            period.EndDate.Should().Be(new DateOnly(2026, 12, 31));
        }

        [Fact]
        public void GetPeriod_CustomStartMonth_ShouldReturnStartYearBasedTaxYearId()
        {
            var project = new ProjectBuilder()
                .AddTaxYearRule(TaxYearType.CustomStartMonth, taxYearStartMonth: 4, taxYearStartDay: 1, taxYearLabeling: TaxYearLabeling.ByStartYear)
                .Build();

            var period = TaxYearCalculator.GetPeriod(project, new DateOnly(2026, 3, 15));

            period.TaxYearId.Should().Be("2025-04");
            period.Label.Should().Be("2025");
            period.StartDate.Should().Be(new DateOnly(2025, 4, 1));
            period.EndDate.Should().Be(new DateOnly(2026, 3, 31));
        }

        [Fact]
        public void GetPeriod_CustomStartMonth_WithByEndYearLabeling_ShouldUseEndYearLabel()
        {
            var project = new ProjectBuilder()
                .AddTaxYearRule(TaxYearType.CustomStartMonth, taxYearStartMonth: 4, taxYearStartDay: 1, taxYearLabeling: TaxYearLabeling.ByEndYear)
                .Build();

            var period = TaxYearCalculator.GetPeriod(project, new DateOnly(2025, 7, 10));

            period.TaxYearId.Should().Be("2025-04");
            period.Label.Should().Be("2026");
        }

        [Fact]
        public void TryParseTaxYearId_CustomStartMonth_WithWrongMonth_ShouldReturnFalse()
        {
            var project = new ProjectBuilder()
                .AddTaxYearRule(TaxYearType.CustomStartMonth, taxYearStartMonth: 4, taxYearStartDay: 1, taxYearLabeling: TaxYearLabeling.ByStartYear)
                .Build();

            var parsed = TaxYearCalculator.TryParseTaxYearId(project, "2025-01", out _);

            parsed.Should().BeFalse();
        }
    }
}
