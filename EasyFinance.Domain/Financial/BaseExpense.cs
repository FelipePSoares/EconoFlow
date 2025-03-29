using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Infrastructure.Extensions;

namespace EasyFinance.Domain.Financial
{
    public abstract class BaseExpense : BaseFinancial
    {
        private BaseExpense() { }

        public BaseExpense(
            string name = "default",
            DateOnly date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default,
            ICollection<ExpenseItem> items = default)
            : base(name, date, amount, createdBy, attachments)
        {
            SetItems(items ?? []);
        }

        public override decimal Amount => Items.Count > 0 ? Items.Sum(e => e.Amount) : base.Amount;
        public ICollection<ExpenseItem> Items { get; private set; } = [];

        public override AppResponse Validate
        {
            get
            {
                var response = base.Validate;

                var itemsValidation = Items.Select(c => c.Validate).ToList();
                if (itemsValidation.Any(c => c.Failed))
                    response.AddErrorMessage(itemsValidation.SelectMany(c => c.Messages.AddPrefix(nameof(this.Items))));

                if (Items.Any(item => Date.Year != item.Date.Year || Date.Month != item.Date.Month))
                    response.AddErrorMessage(nameof(Date), ValidationMessages.CantAddExpenseItemWithDifferentYearOrMonthFromExpense);

                return response;
            }
        }

        public void SetItems(ICollection<ExpenseItem> expenseItems)
        {
            ArgumentNullException.ThrowIfNull(expenseItems);

            Items = expenseItems;
        }

        public void AddItem(ExpenseItem item)
        {
            ArgumentNullException.ThrowIfNull(item);

            Items.Add(item);
        }
    }
}
