using EasyFinance.Common.Tests.Financial;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Infrastructure.Exceptions;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.Financial
{
    public class ExpenseTests
    {
        private readonly Random random;

        public ExpenseTests()
        {
            this.random = new Random();
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(-250)]
        public void SetBudget_SendNegativeGoal_ShouldThrowException(int budget)
        {
            var result = new Expense().SetBudget(budget);

            result.Succeeded.Should().Be(false);
            result.Messages.Should().HaveCount(1);
            result.Messages.First().Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeLessThanZero, "Budget"));            
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddName_SendNullAndEmpty_ShouldThrowException(string name)
        {
            var action = () => new ExpenseBuilder().AddName(name).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"))
                .And.Property.Should().Be("Name");
        }

        [Theory]
        [MemberData(nameof(OlderDates))]
        public void AddDate_SendTooOldDate_ShouldThrowException(DateTime date)
        {
            var action = () => new ExpenseBuilder().AddDate(date).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.CantAddExpenseOlderThanYears, 5))
                .And.Property.Should().Be("Date");
        }

        [Theory]
        [MemberData(nameof(FutureDates))]
        public void AddDate_SendFutureDate_ShouldThrowException(DateTime date)
        {
            var action = () => new ExpenseBuilder().AddAmount(1).AddDate(date).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(ValidationMessages.CantAddFutureExpenseIncome)
                .And.Property.Should().Be("Date");
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(-250)]
        public void AddAmount_SendNegative_ShouldThrowException(decimal amount)
        {
            var action = () => new ExpenseBuilder().AddAmount(amount).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeLessThanZero, "Amount"))
                .And.Property.Should().Be("Amount");
        }

        [Fact]
        public void AddCreatedBy_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseBuilder().AddCreatedBy(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "CreatedBy"))
                .And.Property.Should().Be("CreatedBy");
        }

        [Fact]
        public void AddAttachments_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseBuilder().AddAttachments(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Attachments"))
                .And.Property.Should().Be("Attachments");
        }

        [Fact]
        public void AddItem_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseBuilder().AddItem(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "item"))
                .And.Property.Should().Be("item");
        }

        [Fact]
        public void SetItem_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseBuilder().SetItems(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Items"))
                .And.Property.Should().Be("Items");
        }

        [Fact]
        public void AddItem_SendRandonAmount_ShouldHaveTheSameAmount()
        {
            var value = Convert.ToDecimal(random.NextDouble());

            var item = new ExpenseItemBuilder().AddAmount(value).Build();

            var expense = new ExpenseBuilder().AddItem(item).Build();

            expense.Amount.Should().Be(value);
        }

        [Theory]
        [MemberData(nameof(DifferentDateBetweenExpenseAndExpenseItem))]
        public void AddItem_DifferentYearOrMonthFromExpense_ShouldThrowException(DateTime expenseDate, DateTime expenseItemDate)
        {
            var item = new ExpenseItemBuilder().AddDate(expenseItemDate).Build();

            var action = () => new ExpenseBuilder().AddItem(item).AddDate(expenseDate).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(ValidationMessages.CantAddExpenseItemWithDifferentYearOrMonthFromExpense)
                .And.Property.Should().Be("Date");
        }

        [Theory]
        [MemberData(nameof(DifferentDateBetweenExpenseAndExpenseItem))]
        public void SetItem_DifferentYearOrMonthFromExpense_ShouldThrowException(DateTime expenseDate, DateTime expenseItemDate)
        {
            var item = new ExpenseItemBuilder().AddDate(expenseItemDate).Build();

            var action = () => new ExpenseBuilder().SetItems(new List<ExpenseItem>() { item }).AddDate(expenseDate).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(ValidationMessages.CantAddExpenseItemWithDifferentYearOrMonthFromExpense)
                .And.Property.Should().Be("Date");
        }

        public static IEnumerable<object[]> OlderDates =>
            new List<object[]>
            {
                new object[] { DateTime.Now.AddYears(-5).AddDays(-1) },
                new object[] { DateTime.Now.AddYears(-15) },
                new object[] { DateTime.Now.AddYears(-200) }
            };
            
        public static IEnumerable<object[]> FutureDates =>
            new List<object[]>
            {
                new object[] { DateTime.Now.AddDays(1) },
                new object[] { DateTime.Now.AddDays(5) },
            };
            
        public static IEnumerable<object[]> DifferentDateBetweenExpenseAndExpenseItem =>
            new List<object[]>
            {
                new object[] { DateTime.Today.AddMonths(-2), DateTime.Today.AddMonths(-1) },
                new object[] { DateTime.Today.AddMonths(-1), DateTime.Today.AddMonths(-2) },
                new object[] { DateTime.Today.AddYears(-1), DateTime.Today.AddYears(-2) },
                new object[] { DateTime.Today.AddYears(-2), DateTime.Today.AddYears(-1) },
            };
    }
}
