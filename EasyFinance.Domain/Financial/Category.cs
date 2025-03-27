using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Financial
{
    public class Category : BaseEntity
    {
        public static readonly Category FixedExpenses = new Category(ValidationMessages.FixedExpenses);
        public static readonly Category Comfort = new Category(ValidationMessages.Comfort);
        public static readonly Category Pleasures = new Category(ValidationMessages.Pleasures);
        public static readonly Category YourFuture = new Category(ValidationMessages.YourFuture);
        public static readonly Category SelfImprovement = new Category(ValidationMessages.SelfImprovement);

        private Category() { }

        public Category(string name = "default", ICollection<Expense> expenses = default)
        {
            SetName(name);
            SetExpenses(expenses ?? new List<Expense>());
        }

        public string Name { get; private set; } = string.Empty;
        public bool IsArchived { get; private set; }
        public ICollection<Expense> Expenses { get; private set; } = new List<Expense>();
        public decimal TotalBudget => Expenses.Sum(e => e.Budget);
        public decimal TotalWaste => Expenses.Sum(e => e.Amount);

        /// <summary>
        /// Get All Default Categories
        /// </summary>
        /// <returns></returns>
        public static IEnumerable<Category> GetAllDefaultCategories()
        {
            return new[] { FixedExpenses, Comfort, Pleasures, YourFuture, SelfImprovement };
        }

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

        public void SetArchive()
        {
            IsArchived = true;
        }

        public ICollection<Expense> CopyBudgetToCurrentMonth(User user, DateTime currentDate)
        {
            var previousDate = currentDate.AddMonths(-1);

            var newExpenses = Expenses
                .Where(e => e.Date.Month == previousDate.Month && e.Date.Year == previousDate.Year && e.Budget > 0)
                .Select(expense => expense.CopyBudgetToCurrentMonth(user))
                .Select(appResponse => appResponse.Data)
                .ToList();

            SetExpenses(Expenses.Concat(newExpenses).ToList());

            return newExpenses;
        }
    }
}
