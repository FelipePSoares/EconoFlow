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

        public AppResponse SetBudget(int budget)
        {
            if (budget < 0)
                return AppResponse.Error(code: nameof(budget), description: string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(Budget)));

            Budget = budget;
            return AppResponse.Success();
        }

        public AppResponse<Expense> CopyBudgetToCurrentMonth(User createdBy)
        {
            var expense = new Expense(name: Name, date: Date.AddMonths(1), createdBy: createdBy, budget: Budget);
            return AppResponse<Expense>.Success(expense);
        }
    }
}
