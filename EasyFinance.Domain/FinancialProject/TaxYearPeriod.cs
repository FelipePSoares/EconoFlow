using System;

namespace EasyFinance.Domain.FinancialProject
{
    public readonly record struct TaxYearPeriod(
        string TaxYearId,
        string Label,
        DateOnly StartDate,
        DateOnly EndDate);
}
