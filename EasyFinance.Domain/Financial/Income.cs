using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Shared;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using System;
using System.Collections.Generic;

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

                if (string.IsNullOrEmpty(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

                if (!string.IsNullOrEmpty(Name) && Name.Length > PropertyMaxLengths.GetMaxLength(PropertyType.IncomeName))
                    response.AddErrorMessage(nameof(Name),
                        string.Format(ValidationMessages.PropertyMaxLength,
                        nameof(Name),
                        PropertyMaxLengths.GetMaxLength(PropertyType.IncomeName)));

                if (Date > DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddDays(1)) && Amount > 0)
                    response.AddErrorMessage(nameof(Date), ValidationMessages.CantAddFutureIncome);

                return response;
            }
        }
    }
}
