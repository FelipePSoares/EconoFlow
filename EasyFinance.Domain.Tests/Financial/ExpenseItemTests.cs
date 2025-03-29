using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.Financial;
using EasyFinance.Infrastructure;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.Financial
{
    public class ExpenseItemTests : BaseTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddName_SendNullAndEmpty_ShouldThrowException(string name)
        {
            // Arrange
            var expenseItem = new ExpenseItemBuilder().AddName(name).Build();

            // Act
            var result = expenseItem.Validate;

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
            var expenseItem = new ExpenseItemBuilder().AddDate(date).Build();

            // Act
            var result = expenseItem.Validate;

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
            var expenseItem = new ExpenseItemBuilder().AddDate(date).Build();

            // Act
            var result = expenseItem.Validate;

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
            var expenseItem = new ExpenseItemBuilder().AddAmount(amount).Build();

            // Act
            var result = expenseItem.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Amount");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeLessThanZero, "Amount"));
        }

        [Fact]
        public void AddCreatedBy_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseItemBuilder().AddCreatedBy(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "CreatedBy"));
        }

        [Fact]
        public void AddAttachments_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseItemBuilder().AddAttachments(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Attachments"));
        }

        [Fact]
        public void AddItems_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseItemBuilder().SetItems(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithParameterName("expenseItems");
        }

        [Fact]
        public void AddItem_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseItemBuilder().AddItem(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithParameterName("item");
        }
    }
}
