using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using System;
using System.Collections.Generic;
using System.Linq;

namespace EasyFinance.Domain.Models.Financial
{
    public class Category : BaseEntity
    {
        public static readonly Category FixedExpenses = new Category("Fixed Expenses");
        public static readonly Category Comfort = new Category("Comfort");
        public static readonly Category Pleasures = new Category("Your Future");
        public static readonly Category YourFuture = new Category("Food");
        public static readonly Category SelfImprovement = new Category("Self-Improvement");
        public static readonly Category CustosFixos = new Category("Custos Fixos");

        private Category() { }

        public Category(string name = "default", ICollection<Expense> expenses = default)
        {
            this.SetName(name);
            this.SetExpenses(expenses ?? new List<Expense>());
        }

        public string Name { get; private set; } = string.Empty;
        public bool IsArchived { get; private set; }
        public ICollection<Expense> Expenses { get; private set; } = new List<Expense>();
        public decimal TotalBudget => this.Expenses.Sum(e => e.Budget);
        public decimal TotalWaste => this.Expenses.Sum(e => e.Amount);



        // Optional: Method to get all the defined categories
        public static IEnumerable<Category> GetAll()
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
            this.IsArchived = true;
        }

        public ICollection<Expense> CopyBudgetToCurrentMonth(User user, DateTime currentDate)
        {
            var previousDate = currentDate.AddMonths(-1);

            var newExpenses = this.Expenses.Where(e => e.Date.Month == previousDate.Month && e.Date.Year == previousDate.Year && e.Budget > 0)
                .Select(expense => expense.CopyBudgetToCurrentMonth(user))
                .ToList();

            this.SetExpenses(this.Expenses.Concat(newExpenses).ToList());

            return newExpenses;
        }
    }
}
