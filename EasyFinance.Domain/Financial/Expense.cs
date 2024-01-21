using EasyFinance.Domain.Models.AccessControl;
using System.Collections.Generic;
using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.Financial
{
    public class Expense : BaseExpense
    {
        public Expense(
            string name = "default",
            DateTime date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default,
            ICollection<ExpenseItem> items = default,
            decimal Goal = default)
            : base(name, date, amount, createdBy, attachments, items)
        {
            this.SetGoal(Goal);
        }

        public decimal Goal { get; private set; }

        public void SetGoal(decimal goal)
        {
            this.Goal = goal;

            if (this.Goal < 0)
                throw new ValidationException(nameof(this.Goal), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(this.Goal)));
        }
    }
}
