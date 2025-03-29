using System;
using System.Collections.Generic;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain.Financial
{
    public class Expense : BaseExpense
    {
        private Expense() { }

        public Expense(
            string name = "default",
            DateOnly date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default,
            ICollection<ExpenseItem> items = default,
            int budget = default)
            : base(name, date, amount, createdBy, attachments, items)
        {
            SetBudget(budget);
        }

        public int Budget { get; private set; }

        public override AppResponse Validate
        {
            get
            {
                var response = base.Validate;

                if (Budget < 0)
                    response.AddErrorMessage(nameof(Budget), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(Budget)));

                return response;
            }
        }

        public void SetBudget(int budget) => Budget = budget;

        public AppResponse<Expense> CopyBudgetToNextMonth(User createdBy)
        {
            var expense = new Expense(name: Name, date: Date.AddMonths(1), createdBy: createdBy, budget: Budget);
            return AppResponse<Expense>.Success(expense);
        }
    }
}
