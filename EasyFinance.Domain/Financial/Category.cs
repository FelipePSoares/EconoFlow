using System.Collections.Generic;
using System.Linq;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.Financial
{
    public class Category : BaseEntity
    {
        public Category(string name = "default", decimal goal = default, ICollection<Expense> expenses = default)
        {
            this.SetName(name);
            this.SetGoal(goal);
            this.SetExpenses(expenses ?? new List<Expense>());
        }

        public string Name { get; private set; } = string.Empty;
        public decimal Goal { get; private set; }
        public ICollection<Expense> Expenses { get; private set; } = new List<Expense>();

        public void SetName(string name)
        {
            this.Name = name;

            if (string.IsNullOrEmpty(this.Name))
                throw new ValidationException(nameof(this.Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.Name)));
        }

        public void SetGoal(decimal goal)
        {
            this.Goal = goal;
            ValidateGoal();
        }

        public void SetExpenses(ICollection<Expense> expenses)
        {
            this.Expenses = expenses;

            if (this.Expenses == default)
                throw new ValidationException(nameof(this.Expenses), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Expenses)));

            ValidateGoal();
        }

        public void AddExpense(Expense expense)
        {
            this.Expenses.Add(expense);
            ValidateGoal();
        }

        private void ValidateGoal()
        {
            if (this.Goal < 0)
                throw new ValidationException(nameof(this.Goal), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(this.Goal)));

            var expensesGoal = this.Expenses.Sum(x => x.Goal);

            if (this.Goal < expensesGoal)
                throw new ValidationException(nameof(this.Goal), ValidationMessages.GoalDefinedCantBeLessThanExpensesGoal);
        }
    }
}
