using System;
using System.Collections.Generic;
using EasyFinance.Domain.FinancialProject;

namespace EasyFinance.Application.DTOs.FinancialProject
{
    public class ProjectTaxYearSettingsRequestDTO
    {
        public TaxYearType TaxYearType { get; set; }
        public int? TaxYearStartMonth { get; set; }
        public int? TaxYearStartDay { get; set; }
        public TaxYearLabeling? TaxYearLabeling { get; set; }
    }

    public class ProjectTaxYearSettingsResponseDTO
    {
        public TaxYearType? TaxYearType { get; set; }
        public int? TaxYearStartMonth { get; set; }
        public int? TaxYearStartDay { get; set; }
        public TaxYearLabeling? TaxYearLabeling { get; set; }
    }

    public class TaxYearPeriodResponseDTO
    {
        public string TaxYearId { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public DateOnly StartDate { get; set; }
        public DateOnly EndDate { get; set; }
    }

    public class DeductibleGroupRequestDTO
    {
        public string Name { get; set; } = string.Empty;
    }

    public class DeductibleGroupResponseDTO
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public string TaxYearId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public DateTime ModifiedAt { get; set; }
    }

    public class DeductibleGroupExpenseRequestDTO
    {
        public Guid ExpenseId { get; set; }
    }

    public class DeductibleGroupExpenseResponseDTO
    {
        public Guid ExpenseId { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateOnly Date { get; set; }
        public decimal Amount { get; set; }
    }

    public class DeductibleGroupTotalsResponseDTO
    {
        public string TaxYearId { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public ICollection<DeductibleGroupTotalResponseDTO> Groups { get; set; } = [];
    }

    public class DeductibleGroupTotalResponseDTO
    {
        public Guid GroupId { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public int ExpenseCount { get; set; }
    }
}
