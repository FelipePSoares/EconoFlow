using EasyFinance.Common.Tests.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.Financial
{
    public class ExpenseItemTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddName_SendNullAndEmpty_ShouldThrowException(string name)
        {
            var action = () => new ExpenseItemBuilder().AddName(name).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"))
                .And.Property.Should().Be("Name");
        }

        [Theory]
        [MemberData(nameof(OlderDates))]
        public void AddDate_SendTooOldDate_ShouldThrowException(DateTime date)
        {
            var action = () => new ExpenseItemBuilder().AddDate(date).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.CantAddExpenseOlderThanYears, 5))
                .And.Property.Should().Be("Date");
        }

        [Theory]
        [MemberData(nameof(FutureDates))]
        public void AddDate_SendFutureDate_ShouldThrowException(DateTime date)
        {
            var action = () => new ExpenseItemBuilder().AddDate(date).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(ValidationMessages.CantAddFutureExpense)
                .And.Property.Should().Be("Date");
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(-250)]
        public void AddAmount_SendNegative_ShouldThrowException(decimal amount)
        {
            var action = () => new ExpenseItemBuilder().AddAmount(amount).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeLessThanZero, "Amount"))
                .And.Property.Should().Be("Amount");
        }

        [Fact]
        public void AddCreatedBy_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseItemBuilder().AddCreatedBy(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "CreatedBy"))
                .And.Property.Should().Be("CreatedBy");
        }

        [Fact]
        public void AddAttachments_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseItemBuilder().AddAttachments(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Attachments"))
                .And.Property.Should().Be("Attachments");
        }

        [Fact]
        public void AddItems_SendNull_ShouldThrowException()
        {
            var action = () => new ExpenseItemBuilder().AddItems(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Items"))
                .And.Property.Should().Be("Items");
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
    }
}
