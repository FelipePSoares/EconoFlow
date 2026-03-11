using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using System;

namespace EasyFinance.Domain.FinancialProject
{
    public class PlanEntry : BaseEntity
    {
        private PlanEntry() { }

        public PlanEntry(
            Guid planId = default,
            DateOnly date = default,
            decimal amountSigned = default,
            string note = default)
        {
            SetPlanId(planId);
            SetDate(date);
            SetAmountSigned(amountSigned);
            SetNote(note);
        }

        public Guid PlanId { get; private set; }
        public Plan Plan { get; private set; } = default!;
        public DateOnly Date { get; private set; }
        public decimal AmountSigned { get; private set; }
        public string Note { get; private set; } = string.Empty;

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (PlanId == Guid.Empty)
                    response.AddErrorMessage(nameof(PlanId), ValidationMessages.InvalidData);

                if (Date == DateOnly.MinValue)
                    response.AddErrorMessage(nameof(Date), ValidationMessages.InvalidDate);

                if (AmountSigned == 0)
                    response.AddErrorMessage(nameof(AmountSigned), ValidationMessages.AmountSignedMustBeDifferentFromZero);

                if (!string.IsNullOrEmpty(Note) && Note.Length > 500)
                    response.AddErrorMessage(nameof(Note), string.Format(ValidationMessages.PropertyMaxLength, nameof(Note), 500));

                return response;
            }
        }

        public void SetPlanId(Guid planId) => PlanId = planId;

        public void SetDate(DateOnly date) => Date = date;

        public void SetAmountSigned(decimal amountSigned) => AmountSigned = amountSigned;

        public void SetNote(string note) => Note = note?.Trim() ?? string.Empty;
    }
}
