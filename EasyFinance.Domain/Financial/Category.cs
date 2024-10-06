using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using System.Collections.Generic;

namespace EasyFinance.Domain.Models.Financial
{
    public class Category : BaseEntity
    {
        private Category() { }

        public Category(string name = "default", ICollection<Expense> expenses = default)
        {
            this.SetName(name);
            this.SetExpenses(expenses ?? new List<Expense>());
        }

        public string Name { get; private set; } = string.Empty;
        public ICollection<Expense> Expenses { get; private set; } = new List<Expense>();

        public void SetName(string name)
        {
            if (string.IsNullOrEmpty(name))
                throw new ValidationException(nameof(this.Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.Name)));

            this.Name = name;
        }

        public void SetExpenses(ICollection<Expense> expenses)
        {
            if (expenses == default)
                throw new ValidationException(nameof(this.Expenses), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Expenses)));

            this.Expenses = expenses;
        }

        public void AddExpense(Expense expense)
        {
            if (expense == default)
                throw new ValidationException(nameof(expense), string.Format(ValidationMessages.PropertyCantBeNull, nameof(expense)));

            this.Expenses.Add(expense);
        }
    }
}
