using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Financial
{
    public abstract class BaseExpense : BaseFinancial
    {
        private BaseExpense() { }

        public BaseExpense(
            string name = "default",
            DateTime date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default,
            ICollection<ExpenseItem> items = default)
            : base(name, date, amount, createdBy, attachments)
        {
            SetItems(items ?? new List<ExpenseItem>());
        }

        public ICollection<ExpenseItem> Items { get; private set; } = new List<ExpenseItem>();

        public void SetItems(ICollection<ExpenseItem> expenseItems)
        {
            if (expenseItems == default)
                throw new ValidationException(nameof(Items), string.Format(ValidationMessages.PropertyCantBeNull, nameof(Items)));

            if (expenseItems.Count > 0)
                SetAmount(expenseItems.Sum(e => e.Amount));

            if (expenseItems.Any(item => Date.Year != item.Date.Year || Date.Month != item.Date.Month))
                throw new ValidationException(nameof(Date), ValidationMessages.CantAddExpenseItemWithDifferentYearOrMonthFromExpense);

            Items = expenseItems;
        }

        public void AddItem(ExpenseItem item)
        {
            if (item == default)
                throw new ValidationException(nameof(item), string.Format(ValidationMessages.PropertyCantBeNull, nameof(item)));

            if (Date.Year != item.Date.Year || Date.Month != item.Date.Month)
                throw new ValidationException(nameof(item.Date), ValidationMessages.CantAddExpenseItemWithDifferentYearOrMonthFromExpense);

            SetAmount(Amount + item.Amount);

            Items.Add(item);
        }
    }
}
