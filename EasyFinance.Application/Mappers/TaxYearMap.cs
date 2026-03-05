using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using System;
using System.Collections.Generic;
using System.Linq;

namespace EasyFinance.Application.Mappers
{
    public static class TaxYearMap
    {
        public static ProjectTaxYearSettingsResponseDTO ToTaxYearSettingsDTO(this Project project)
        {
            ArgumentNullException.ThrowIfNull(project);

            return new ProjectTaxYearSettingsResponseDTO
            {
                TaxYearType = project.TaxYearType,
                TaxYearStartMonth = project.TaxYearStartMonth,
                TaxYearStartDay = project.TaxYearStartDay,
                TaxYearLabeling = project.TaxYearLabeling
            };
        }

        public static TaxYearPeriodResponseDTO ToDTO(this TaxYearPeriod period)
        {
            return new TaxYearPeriodResponseDTO
            {
                TaxYearId = period.TaxYearId,
                Label = period.Label,
                StartDate = period.StartDate,
                EndDate = period.EndDate
            };
        }

        public static ICollection<TaxYearPeriodResponseDTO> ToDTO(this IEnumerable<TaxYearPeriod> periods)
            => periods.Select(period => period.ToDTO()).ToList();

        public static DeductibleGroupResponseDTO ToDTO(this DeductibleGroup group)
        {
            ArgumentNullException.ThrowIfNull(group);

            return new DeductibleGroupResponseDTO
            {
                Id = group.Id,
                ProjectId = group.ProjectId,
                TaxYearId = group.TaxYearId,
                Name = group.Name,
                CreatedDate = group.CreatedDate,
                ModifiedAt = group.ModifiedAt
            };
        }

        public static ICollection<DeductibleGroupResponseDTO> ToDTO(this IEnumerable<DeductibleGroup> groups)
            => groups.Select(group => group.ToDTO()).ToList();

        public static DeductibleGroupExpenseResponseDTO ToDeductibleGroupExpenseDTO(this Expense expense)
        {
            ArgumentNullException.ThrowIfNull(expense);

            return new DeductibleGroupExpenseResponseDTO
            {
                ExpenseId = expense.Id,
                ExpenseItemId = null,
                Name = expense.Name,
                Date = expense.Date,
                Amount = expense.Amount
            };
        }

        public static DeductibleGroupExpenseResponseDTO ToDeductibleGroupExpenseDTO(this ExpenseItem expenseItem)
        {
            ArgumentNullException.ThrowIfNull(expenseItem);

            return new DeductibleGroupExpenseResponseDTO
            {
                ExpenseId = null,
                ExpenseItemId = expenseItem.Id,
                Name = expenseItem.Name,
                Date = expenseItem.Date,
                Amount = expenseItem.Amount
            };
        }

        public static DeductibleGroupExpenseResponseDTO ToDeductibleGroupExpenseDTO(this DeductibleGroupExpense assignment)
        {
            ArgumentNullException.ThrowIfNull(assignment);

            if (assignment.ExpenseItem != null)
                return assignment.ExpenseItem.ToDeductibleGroupExpenseDTO();

            if (assignment.Expense != null)
                return assignment.Expense.ToDeductibleGroupExpenseDTO();

            return new DeductibleGroupExpenseResponseDTO();
        }

        public static ICollection<DeductibleGroupExpenseResponseDTO> ToDeductibleGroupExpenseDTO(this IEnumerable<DeductibleGroupExpense> assignments)
            => assignments.Select(assignment => assignment.ToDeductibleGroupExpenseDTO()).ToList();
    }
}
