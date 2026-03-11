using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using System;
using System.Collections.Generic;

namespace EasyFinance.Domain.FinancialProject
{
    public class Plan : BaseEntity
    {
        private Plan() { }

        public Plan(
            Guid projectId = default,
            PlanType type = PlanType.EmergencyReserve,
            string name = "default",
            decimal targetAmount = default,
            decimal currentBalance = default,
            bool isArchived = false,
            ICollection<PlanEntry> entries = default)
        {
            SetProjectId(projectId);
            SetType(type);
            SetName(name);
            SetTargetAmount(targetAmount);
            SetCurrentBalance(currentBalance);
            SetEntries(entries ?? []);
            if (isArchived)
                SetArchive();
        }

        public Guid ProjectId { get; private set; }
        public Project Project { get; private set; } = default!;
        public PlanType Type { get; private set; } = PlanType.EmergencyReserve;
        public string Name { get; private set; } = string.Empty;
        public decimal TargetAmount { get; private set; }
        public decimal CurrentBalance { get; private set; }
        public bool IsArchived { get; private set; }
        public ICollection<PlanEntry> Entries { get; private set; } = [];

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (ProjectId == Guid.Empty)
                    response.AddErrorMessage(nameof(ProjectId), ValidationMessages.InvalidProjectId);

                if (string.IsNullOrWhiteSpace(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));
                else if (Name.Length > 150)
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyMaxLength, nameof(Name), 150));

                if (TargetAmount < 0)
                    response.AddErrorMessage(nameof(TargetAmount), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(TargetAmount)));

                return response;
            }
        }

        public void SetProjectId(Guid projectId) => ProjectId = projectId;

        public void SetType(PlanType type) => Type = type;

        public void SetName(string name) => Name = name?.Trim() ?? string.Empty;

        public void SetTargetAmount(decimal targetAmount) => TargetAmount = targetAmount;

        public void SetCurrentBalance(decimal currentBalance) => CurrentBalance = currentBalance;

        public void SetEntries(ICollection<PlanEntry> entries) => Entries = entries;

        public void AddEntry(PlanEntry entry)
        {
            ArgumentNullException.ThrowIfNull(entry);
            Entries.Add(entry);
            ApplyEntry(entry.AmountSigned);
        }

        public void ApplyEntry(decimal amountSigned) => CurrentBalance += amountSigned;

        public decimal GetRemaining() => TargetAmount - CurrentBalance;

        public decimal GetProgress() => TargetAmount <= 0 ? 0 : CurrentBalance / TargetAmount;

        public void SetArchive() => IsArchived = true;
    }
}
