using EasyFinance.Domain.FinancialProject;
using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.FinancialProject
{
    public class ProjectRequestDTO
    {
        public string Name { get; set; } = string.Empty;
        public string PreferredCurrency { get; set; } = string.Empty;
    }

    public class ProjectResponseDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string PreferredCurrency { get; set; } = string.Empty;
        public TaxYearType? TaxYearType { get; set; }
        public int? TaxYearStartMonth { get; set; }
        public int? TaxYearStartDay { get; set; }
        public TaxYearLabeling? TaxYearLabeling { get; set; }
    }

    public class ProjectOverviewSummaryResponseDTO
    {
        public decimal TotalIncome { get; set; }
        public decimal TotalExpense { get; set; }
        public ICollection<TransactionResponseDTO> LatestTransactions { get; set; } = [];
    }
}
