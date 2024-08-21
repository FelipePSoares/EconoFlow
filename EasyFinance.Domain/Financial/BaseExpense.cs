using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.Financial
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
            this.SetItems(items ?? new List<ExpenseItem>());
        }

        public ICollection<ExpenseItem> Items { get; private set; } = new List<ExpenseItem>();

        public void SetItems(ICollection<ExpenseItem> expenseItems)
        {
            if (expenseItems == default)
                throw new ValidationException(nameof(this.Items), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Items)));

            this.SetAmount(expenseItems.Sum(e => e.Amount));

            this.Items = expenseItems;
        }

        public void AddItem(ExpenseItem item)
        {
            if (item == default)
                throw new ValidationException(nameof(item), string.Format(ValidationMessages.PropertyCantBeNull, nameof(item)));

            this.SetAmount(this.Amount + item.Amount);

            this.Items.Add(item);
        }
    }
}
