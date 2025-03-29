using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.Financial;
using EasyFinance.Infrastructure;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.Financial
{
    public class ExpenseTests : BaseTests
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
            // Arrange
            var expense = new ExpenseBuilder().SetBudget(budget).Build();

            // Act
            var result = expense.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Budget");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeLessThanZero, "Budget"));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddName_SendNullAndEmpty_ShouldThrowException(string name)
        {
            // Arrange
            var expense = new ExpenseBuilder().AddName(name).Build();

            // Act
            var result = expense.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Name");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"));
        }

        [Theory]
        [MemberData(nameof(OlderDates))]
        public void AddDate_SendTooOldDate_ShouldThrowException(DateOnly date)
        {
            // Arrange
            var expense = new ExpenseBuilder().AddDate(date).Build();

            // Act
            var result = expense.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Date");
            message.Description.Should().Be(string.Format(ValidationMessages.CantAddExpenseOlderThanYears, 5));
        }

        [Theory]
        [MemberData(nameof(FutureDates))]
        public void AddDate_SendFutureDate_ShouldThrowException(DateOnly date)
        {
            // Arrange
            var expense = new ExpenseBuilder().AddDate(date).Build();

            // Act
            var result = expense.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Date");
            message.Description.Should().Be(ValidationMessages.CantAddFutureExpenseIncome);
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(-250)]
        public void AddAmount_SendNegative_ShouldThrowException(decimal amount)
        {
            // Arrange
            var expense = new ExpenseBuilder().AddAmount(amount).Build();

            // Act
            var result = expense.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Amount");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeLessThanZero, "Amount"));
        }

        [Fact]
        public void AddCreatedBy_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseBuilder().AddCreatedBy(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "CreatedBy"));
        }

        [Fact]
        public void AddAttachments_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseBuilder().AddAttachments(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Attachments"));
        }

        [Fact]
        public void AddItem_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseBuilder().AddItem(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithParameterName("item");
        }

        [Fact]
        public void AddItems_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseBuilder().SetItems(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithParameterName("expenseItems");
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
        public void AddItem_DifferentYearOrMonthFromExpense_ShouldThrowException(DateOnly expenseDate, DateOnly expenseItemDate)
        {
            // Arrange
            var item = new ExpenseItemBuilder().AddDate(expenseItemDate).Build();
            var expense = new ExpenseBuilder().AddItem(item).AddDate(expenseDate).Build();

            // Act
            var result = expense.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Date");
            message.Description.Should().Be(ValidationMessages.CantAddExpenseItemWithDifferentYearOrMonthFromExpense);
        }

        public static TheoryData<DateOnly, DateOnly> DifferentDateBetweenExpenseAndExpenseItem => new()
            {
                { DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddMonths(-2)), DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddMonths(-1)) },
                { DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-1)), DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-2)) },
                { DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-2)), DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-1)) }
            };
    }
}
