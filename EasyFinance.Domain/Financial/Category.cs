using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain.Financial
{
    public class Category : BaseEntity
    {
        public static readonly Category FixedExpenses = new(ValidationMessages.FixedExpenses);
        public static readonly Category Comfort = new(ValidationMessages.Comfort);
        public static readonly Category Pleasures = new(ValidationMessages.Pleasures);
        public static readonly Category YourFuture = new(ValidationMessages.YourFuture);
        public static readonly Category SelfImprovement = new(ValidationMessages.SelfImprovement);

        private Category() { }

        public Category(string name = "default", ICollection<Expense> expenses = default)
        {
            SetName(name);
            SetExpenses(expenses ?? []);
        }

        public string Name { get; private set; } = string.Empty;
        public bool IsArchived { get; private set; }
        public ICollection<Expense> Expenses { get; private set; } = [];
        public decimal TotalBudget => Expenses.Sum(e => e.Budget);
        public decimal TotalWaste => Expenses.Sum(e => e.Amount);

        public override AppResponse Validate 
        {
            get
            {
                var response = AppResponse.Success();

                if (string.IsNullOrEmpty(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

                return response;
            }
        }

        public static IEnumerable<Category> GetAllDefaultCategories() => [FixedExpenses, Comfort, Pleasures, YourFuture, SelfImprovement];

        public void SetName(string name) => this.Name = name;

        public void SetExpenses(ICollection<Expense> expenses)
        {
            ArgumentNullException.ThrowIfNull(expenses);

            this.Expenses = expenses;
        }

        public void AddExpense(Expense expense)
        {
            ArgumentNullException.ThrowIfNull(expense);

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
                .Select(expense => expense.CopyBudgetToNextMonth(user))
                .Select(appResponse => appResponse.Data)
                .ToList();

            SetExpenses(Expenses.Concat(newExpenses).ToList());

            return newExpenses;
        }
    }
}
