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

        public Category(string name = "default", params Expense[] expenses)
        {
            SetName(name);
            SetExpenses(expenses);
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

        public static IEnumerable<(Category category, int percentage)> GetAllDefaultCategories()
        {
            return [
                (category: FixedExpenses, percentage: 30),
                (category: Comfort, percentage: 20),
                (category: Pleasures, percentage: 20),
                (category: YourFuture, percentage: 25),
                (category: SelfImprovement, percentage: 5)
                ];
        }

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

        public static Category CreateDefaultCategoryWithExpense(User user, string name, int percentage, decimal annualIncome, DateOnly date){
            var monthIncome = annualIncome / 12;

            if (name == FixedExpenses.Name)
            {
                var categoryBudget = Convert.ToInt32(monthIncome) * percentage / 100;

                return new Category(
                    name,
                    new Expense(
                        ValidationMessages.Housing,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 50 / 100),
                    new Expense(
                        ValidationMessages.BasicUtilities,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 17 / 100),
                    new Expense(
                        ValidationMessages.Transportation,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 17 / 100),
                    new Expense(
                        ValidationMessages.Healthcare,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 16 / 100)
                );
            }
            else if (name == Comfort.Name)
            {
                var categoryBudget = Convert.ToInt32(monthIncome) * percentage / 100;

                return new Category(
                    name,
                    new Expense(
                        ValidationMessages.ExtraFood,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 40 / 100),
                    new Expense(
                        ValidationMessages.HomeImprovements,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 25 / 100),
                    new Expense(
                        ValidationMessages.SubscriptionsServices,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 25 / 100),
                    new Expense(
                        ValidationMessages.OtherPersonalComforts,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 10 / 100)
                );
            }
            else if (name == Pleasures.Name)
            {
                var categoryBudget = Convert.ToInt32(monthIncome) * percentage / 100;

                return new Category(
                    name,
                    new Expense(
                        ValidationMessages.TravelTrips,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 50 / 100),
                    new Expense(
                        ValidationMessages.Entertainment,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 25 / 100),
                    new Expense(
                        ValidationMessages.GoingOutwithFriendsFamily,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 25 / 100)
                );
            }
            else if (name == YourFuture.Name)
            {
                var categoryBudget = Convert.ToInt32(monthIncome) * percentage / 100;

                return new Category(
                    name,
                    new Expense(
                        ValidationMessages.Investments,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 40 / 100),
                    new Expense(
                        ValidationMessages.EmergencyFund,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 20 / 100),
                    new Expense(
                        ValidationMessages.RetirementSavings,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 20 / 100),
                    new Expense(
                        ValidationMessages.BigProjects,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 20 / 100)
                );
            }
            else if (name == SelfImprovement.Name)
            {
                var categoryBudget = Convert.ToInt32(monthIncome) * percentage / 100;

                return new Category(
                    name,
                    new Expense(
                        ValidationMessages.Education,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 60 / 100),
                    new Expense(
                        ValidationMessages.MentalPhysicalHealth,
                        date,
                        0,
                        user,
                        budget: categoryBudget * 40 / 100)
                );}
            else{
                return new Category(
                    name,
                    new Expense(
                        ValidationMessages.ExampleExpense,
                        date,
                        0,
                        user,
                        budget: Convert.ToInt32(monthIncome) * percentage / 100
                ));
            }
        }
    }
}
