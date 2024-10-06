using EasyFinance.Common.Tests.Financial;
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
        public void AddName_SendNullAndEmpty_ShouldThrowException(string name)
        {
            var action = () => new CategoryBuilder().AddName(name).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"))
                .And.Property.Should().Be("Name");
        }

        [Fact]
        public void AddExpenses_SendNull_ShouldThrowException()
        {
            var action = () => new CategoryBuilder().AddExpenses(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Expenses"))
                .And.Property.Should().Be("Expenses");
        }

        public static IEnumerable<object[]> InvalidDates =>
            new List<object[]>
            {
            new object[] { DateTime.Now.AddDays(1) },
            new object[] { DateTime.Now.AddYears(-200) }
            };
    }
}
