using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Shared;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using System;
using System.Collections.Generic;

namespace EasyFinance.Domain.Financial
{
    public class ExpenseItem : BaseExpense
    {
        private ExpenseItem() { }

        public ExpenseItem(
            string name = "default",
            DateOnly date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default,
            ICollection<ExpenseItem> items = default)
            : base(name, date, amount, createdBy, attachments, items)
        {
        }

        public override AppResponse Validate
        {
            get
            {
                var response = base.Validate;

                if (!string.IsNullOrEmpty(Name) && Name.Length > PropertyMaxLengths.GetMaxLength(PropertyType.ExpenseItemName))
                    response.AddErrorMessage(nameof(Name),
                        string.Format(ValidationMessages.PropertyMaxLength,
                        nameof(Name),
                        PropertyMaxLengths.GetMaxLength(PropertyType.ExpenseItemName)));

                return response;
            }
        }
    }
}
