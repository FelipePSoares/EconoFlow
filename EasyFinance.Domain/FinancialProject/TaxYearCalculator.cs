using System;
using System.Collections.Generic;
using System.Globalization;

namespace EasyFinance.Domain.FinancialProject
{
    public static class TaxYearCalculator
    {
        public static bool IsConfigured(Project project)
        {
            ArgumentNullException.ThrowIfNull(project);

            return project.TaxYearType.HasValue;
        }

        public static TaxYearPeriod GetPeriod(Project project, DateOnly date)
        {
            ArgumentNullException.ThrowIfNull(project);

            if (!project.TaxYearType.HasValue)
                throw new InvalidOperationException("Tax year rule is not configured.");

            return project.TaxYearType.Value switch
            {
                TaxYearType.CalendarYear => BuildCalendarPeriod(date.Year),
                TaxYearType.CustomStartMonth => BuildCustomPeriod(project, date),
                _ => throw new ArgumentOutOfRangeException(nameof(project.TaxYearType), project.TaxYearType, "Unsupported tax year type.")
            };
        }

        public static IEnumerable<TaxYearPeriod> GetPeriods(Project project, DateOnly fromDate, DateOnly toDate)
        {
            ArgumentNullException.ThrowIfNull(project);

            if (fromDate > toDate)
                (fromDate, toDate) = (toDate, fromDate);

            var firstPeriod = GetPeriod(project, fromDate);
            var lastPeriod = GetPeriod(project, toDate);
            var currentStartDate = firstPeriod.StartDate;

            while (currentStartDate <= lastPeriod.StartDate)
            {
                yield return GetPeriod(project, currentStartDate);
                currentStartDate = currentStartDate.AddYears(1);
            }
        }

        public static bool TryParseTaxYearId(Project project, string taxYearId, out TaxYearPeriod period)
        {
            ArgumentNullException.ThrowIfNull(project);

            period = default;

            if (!project.TaxYearType.HasValue || string.IsNullOrWhiteSpace(taxYearId))
                return false;

            if (project.TaxYearType.Value == TaxYearType.CalendarYear)
            {
                var parsedYear = ParseFourDigitYear(taxYearId);
                if (!parsedYear.HasValue)
                    return false;

                period = BuildCalendarPeriod(parsedYear.Value);
                return true;
            }

            var startMonth = project.TaxYearStartMonth;
            if (!startMonth.HasValue)
                return false;

            if (taxYearId.Length != 7 || taxYearId[4] != '-')
                return false;

            var startYear = ParseFourDigitYear(taxYearId[..4]);
            if (!startYear.HasValue)
                return false;

            if (!int.TryParse(taxYearId[5..7], NumberStyles.None, CultureInfo.InvariantCulture, out var parsedMonth))
                return false;

            if (parsedMonth != startMonth.Value)
                return false;

            var startDate = BuildCustomStartDate(startYear.Value, startMonth.Value, project.TaxYearStartDay ?? 1);
            var endDate = startDate.AddYears(1).AddDays(-1);
            var label = BuildLabel(project, startDate, endDate);

            period = new TaxYearPeriod(
                TaxYearId: $"{startYear.Value:D4}-{startMonth.Value:D2}",
                Label: label,
                StartDate: startDate,
                EndDate: endDate);

            return true;
        }

        private static TaxYearPeriod BuildCalendarPeriod(int year)
        {
            var startDate = new DateOnly(year, 1, 1);
            var endDate = new DateOnly(year, 12, 31);
            var label = year.ToString(CultureInfo.InvariantCulture);

            return new TaxYearPeriod(
                TaxYearId: label,
                Label: label,
                StartDate: startDate,
                EndDate: endDate);
        }

        private static TaxYearPeriod BuildCustomPeriod(Project project, DateOnly date)
        {
            var startMonth = project.TaxYearStartMonth
                ?? throw new InvalidOperationException("Custom tax year start month is not configured.");
            var startDay = project.TaxYearStartDay ?? 1;

            var thisYearStartDate = BuildCustomStartDate(date.Year, startMonth, startDay);
            var startYear = date >= thisYearStartDate ? date.Year : date.Year - 1;
            var startDate = BuildCustomStartDate(startYear, startMonth, startDay);
            var endDate = startDate.AddYears(1).AddDays(-1);
            var taxYearId = $"{startDate.Year:D4}-{startMonth:D2}";
            var label = BuildLabel(project, startDate, endDate);

            return new TaxYearPeriod(
                TaxYearId: taxYearId,
                Label: label,
                StartDate: startDate,
                EndDate: endDate);
        }

        private static string BuildLabel(Project project, DateOnly startDate, DateOnly endDate)
        {
            var labeling = project.TaxYearLabeling ?? TaxYearLabeling.ByStartYear;
            var labelYear = labeling == TaxYearLabeling.ByEndYear ? endDate.Year : startDate.Year;

            return labelYear.ToString(CultureInfo.InvariantCulture);
        }

        private static DateOnly BuildCustomStartDate(int year, int month, int day)
        {
            var daysInMonth = DateTime.DaysInMonth(year, month);
            var boundedDay = Math.Max(1, Math.Min(day, daysInMonth));

            return new DateOnly(year, month, boundedDay);
        }

        private static int? ParseFourDigitYear(string yearText)
        {
            if (!int.TryParse(yearText, NumberStyles.None, CultureInfo.InvariantCulture, out var parsedYear))
                return null;

            return parsedYear is < 1 or > 9999 ? null : parsedYear;
        }
    }
}
