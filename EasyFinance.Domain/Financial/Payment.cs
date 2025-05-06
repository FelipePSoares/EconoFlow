using System;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain.Financial
{
    public class Payment : BaseEntity
    {
        private Payment() { }

        public decimal Amount { get; set; }
        public PaymentStatus Status { get; set; }
        public DateOnly Date { get; set; }
        public PaymentType Type { get; set; }
        public Frequency Frequency { get; set; }
        public Client Client { get; set; }

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (Amount < 0)
                    response.AddErrorMessage(nameof(Amount), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(Amount)));

                if (this.Type == PaymentType.Recurring && this.Frequency == Frequency.None)
                    response.AddErrorMessage(nameof(Frequency), string.Format(ValidationMessages.PropertyCantBeNull, nameof(Frequency)));

                if (Client == default)
                    response.AddErrorMessage(nameof(Client), string.Format(ValidationMessages.PropertyCantBeNull, nameof(Client)));

                return response;
            }
        }
    }
}
