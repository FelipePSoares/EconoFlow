using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Domain.FinancialProject;

namespace EasyFinance.Application.Mappers
{
    public static class PlanMap
    {
        public static IEnumerable<PlanResponseDTO> ToDTO(this IEnumerable<Plan> plans)
            => plans.Select(plan => plan.ToDTO());

        public static PlanResponseDTO ToDTO(this Plan plan)
        {
            ArgumentNullException.ThrowIfNull(plan);

            return new PlanResponseDTO
            {
                Id = plan.Id,
                ProjectId = plan.ProjectId,
                Type = NormalizeType(plan.Type),
                Name = plan.Name,
                TargetAmount = plan.TargetAmount,
                CurrentBalance = plan.CurrentBalance,
                Remaining = plan.GetRemaining(),
                Progress = plan.GetProgress(),
                IsArchived = plan.IsArchived
            };
        }

        public static PlanRequestDTO ToRequestDTO(this Plan plan)
        {
            ArgumentNullException.ThrowIfNull(plan);

            return new PlanRequestDTO
            {
                Type = NormalizeType(plan.Type),
                Name = plan.Name,
                TargetAmount = plan.TargetAmount
            };
        }

        public static Plan FromDTO(this PlanRequestDTO planDto, Plan plan = null)
        {
            ArgumentNullException.ThrowIfNull(planDto);

            if (plan != null)
            {
                plan.SetType(planDto.Type);
                plan.SetName(planDto.Name);
                plan.SetTargetAmount(planDto.TargetAmount);
                return plan;
            }

            return new Plan(
                type: planDto.Type,
                name: planDto.Name,
                targetAmount: planDto.TargetAmount);
        }

        public static IEnumerable<PlanEntryResponseDTO> ToDTO(this IEnumerable<PlanEntry> entries)
            => entries.Select(entry => entry.ToDTO());

        public static PlanEntryResponseDTO ToDTO(this PlanEntry entry)
        {
            ArgumentNullException.ThrowIfNull(entry);

            return new PlanEntryResponseDTO
            {
                Id = entry.Id,
                PlanId = entry.PlanId,
                Date = entry.Date,
                AmountSigned = entry.AmountSigned,
                Note = entry.Note
            };
        }

        private static PlanType NormalizeType(PlanType type)
            => type == PlanType.EmergencyReserve
                ? PlanType.EmergencyReserve
                : PlanType.Saving;
    }
}
