using System;
using EasyFinance.Domain.FinancialProject;

namespace EasyFinance.Application.DTOs.FinancialProject
{
    public class PlanRequestDTO
    {
        public PlanType Type { get; set; } = PlanType.EmergencyReserve;
        public string Name { get; set; } = string.Empty;
        public decimal TargetAmount { get; set; }
    }

    public class PlanResponseDTO
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public PlanType Type { get; set; } = PlanType.EmergencyReserve;
        public string Name { get; set; } = string.Empty;
        public decimal TargetAmount { get; set; }
        public decimal CurrentBalance { get; set; }
        public decimal Remaining { get; set; }
        public decimal Progress { get; set; }
        public bool IsArchived { get; set; }
    }

    public class PlanEntryRequestDTO
    {
        public DateOnly Date { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
        public decimal AmountSigned { get; set; }
        public string Note { get; set; } = string.Empty;
    }

    public class PlanEntryResponseDTO
    {
        public Guid Id { get; set; }
        public Guid PlanId { get; set; }
        public DateOnly Date { get; set; }
        public decimal AmountSigned { get; set; }
        public string Note { get; set; } = string.Empty;
    }

}
