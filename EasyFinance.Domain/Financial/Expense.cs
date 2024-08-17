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
            int Goal = default)
            : base(name, date, amount, createdBy, attachments, items)
        {
            this.SetGoal(Goal);
        }

        public int Goal { get; private set; }

        public void SetGoal(int goal)
        {
            if (goal < 0)
                throw new ValidationException(nameof(this.Goal), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(this.Goal)));

            this.Goal = goal;
        }

        public void AddExpenseItem(ExpenseItem expenseItem)
        {
            if (expenseItem == default)
                throw new ValidationException(nameof(expenseItem), string.Format(ValidationMessages.PropertyCantBeNull, nameof(expenseItem)));

            this.Items.Add(expenseItem);
        }
    }
}
