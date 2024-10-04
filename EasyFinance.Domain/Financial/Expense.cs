using EasyFinance.Domain.Models.AccessControl;
using System.Collections.Generic;
using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.Financial
{
    public class Expense : BaseExpense
    {
        private Expense() { }

        public Expense(
            string name = "default",
            DateTime date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default,
            ICollection<ExpenseItem> items = default,
            int budget = default)
            : base(name, date, amount, createdBy, attachments, items)
        {
            this.SetBudget(budget);
        }

        public int Budget { get; private set; }

        public void SetBudget(int budget)
        {
            if (budget < 0)
                throw new ValidationException(nameof(this.Budget), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(this.Budget)));

            this.Budget = budget;
        }
    }
}
