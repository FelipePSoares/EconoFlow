using EasyFinance.Common.Tests.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.Financial
{
    public class IncomeTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddName_SendNullAndEmpty_ShouldThrowException(string name)
        {
            var action = () => new IncomeBuilder().AddName(name).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"))
                .And.Property.Should().Be("Name");
        }

        [Theory]
        [MemberData(nameof(InvalidDates))]
        public void AddDate_SendInvalidDate_ShouldThrowException(DateTime date)
        {
            var action = () => new IncomeBuilder().AddDate(date).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(ValidationMessages.InvalidDate)
                .And.Property.Should().Be("Date");
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(-250)]
        public void AddAmount_SendNegative_ShouldThrowException(decimal amount)
        {
            var action = () => new IncomeBuilder().AddAmount(amount).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeLessThanZero, "Amount"))
                .And.Property.Should().Be("Amount");
        }

        [Fact]
        public void AddCreatedBy_SendNull_ShouldThrowException()
        {
            var action = () => new IncomeBuilder().AddCreatedBy(null).Build();

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

        public static IEnumerable<object[]> InvalidDates =>
            new List<object[]>
            {
            new object[] { DateTime.Now.AddDays(1) },
            new object[] { DateTime.Now.AddYears(-200) }
            };
    }
}
