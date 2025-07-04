using System;
using System.Collections.Generic;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain.Financial
{
    public class Income : BaseFinancial
    {
        private Income() { }

        public Income(
            string name = "default",
            DateOnly date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default)
            : base(name, date, amount, createdBy, attachments)
        {
        }

        public override AppResponse Validate
        {
            get
            {
                var response = base.Validate;

                if (Date > DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddDays(1)) && Amount > 0)
                    response.AddErrorMessage(nameof(Date), ValidationMessages.CantAddFutureExpenseIncome);

                return response;
            }
        }
    }
}
