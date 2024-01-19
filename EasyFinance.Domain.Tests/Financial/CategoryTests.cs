using EasyFinance.Common.Tests.Financial;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.Financial
{
    public class CategoryTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void ValidateNameNullOrEmpty(string name)
        {
            var action = () => new CategoryBuilder().AddName(name).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"))
                .And.Property.Should().Be("Name");
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(-250)]
        public void ValidateGoalNegative(decimal goal)
        {
            var action = () => new CategoryBuilder().AddGoal(goal).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeLessThanZero, "Goal"))
                .And.Property.Should().Be("Goal");
        }

        [Fact]
        public void ValidateExpensesNull()
        {
            var action = () => new CategoryBuilder().AddExpenses(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Expenses"))
                .And.Property.Should().Be("Expenses");
        }

        [Fact]
        public void ValidateAddNewCategoryGoalLessThanTheSumExpensesGoal()
        {
            var expense = new ExpenseBuilder().AddGoal(100).Build();
            var category = new CategoryBuilder().AddGoal(200).AddExpenses(new List<Expense>() { expense });

            var action = () => category.AddGoal(50).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(ValidationMessages.GoalDefinedCantBeLessThanExpensesGoal)
                .And.Property.Should().Be("Goal");
        }

        [Fact]
        public void ValidateNewExpensesGoalGreaterThanCategoryGoal()
        {
            var expense = new ExpenseBuilder().AddGoal(100).Build();

            var action = () => new CategoryBuilder().AddExpenses(new List<Expense>() { expense }).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(ValidationMessages.GoalDefinedCantBeLessThanExpensesGoal)
                .And.Property.Should().Be("Goal");
        }

        public static IEnumerable<object[]> InvalidDates =>
            new List<object[]>
            {
            new object[] { DateTime.Now.AddDays(1) },
            new object[] { DateTime.Now.AddYears(-200) }
            };
    }
}
