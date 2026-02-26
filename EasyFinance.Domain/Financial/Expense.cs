using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Shared;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using System;
using System.Collections.Generic;

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
            int budget = default,
            bool isDeductible = false)
            : base(name, date, amount, createdBy, attachments, items)
        {
            SetBudget(budget);
            SetIsDeductible(isDeductible);
        }

        public int Budget { get; private set; }
        public bool IsDeductible { get; private set; }

        public override AppResponse Validate
        {
            get
            {
                var response = base.Validate;

                if (string.IsNullOrEmpty(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

                if (Budget < 0)
                    response.AddErrorMessage(nameof(Budget), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(Budget)));

                if (!string.IsNullOrEmpty(Name) && Name.Length > PropertyMaxLengths.GetMaxLength(PropertyType.ExpenseName))
                    response.AddErrorMessage(nameof(Name),
                        string.Format(ValidationMessages.PropertyMaxLength,
                        nameof(Name),
                        PropertyMaxLengths.GetMaxLength(PropertyType.ExpenseName)));

                return response;
            }
        }

        public void SetBudget(int budget) => Budget = budget;
        public void SetIsDeductible(bool isDeductible) => IsDeductible = isDeductible;

        public AppResponse<Expense> CopyBudgetToNextMonth(User createdBy)
        {
            var expense = new Expense(name: Name, date: Date.AddMonths(1), createdBy: createdBy, budget: Budget);
            return AppResponse<Expense>.Success(expense);
        }
    }
}
