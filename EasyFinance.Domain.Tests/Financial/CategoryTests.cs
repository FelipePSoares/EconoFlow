using EasyFinance.Common.Tests.Financial;
using EasyFinance.Infrastructure;
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
            // Arrange
            var category = new CategoryBuilder().AddName(name).Build();

            // Act
            var result = category.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Name");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"));
        }

        [Fact]
        public void AddExpenses_SendNull_ShouldThrowException()
        {
            var action = () => new CategoryBuilder().AddExpenses(null).Build();

            action.Should().Throw<ArgumentNullException>().WithParameterName("expenses");
        }

        public static TheoryData<DateTime> InvalidDates =>
            [
                DateTime.Now.AddDays(1),
                DateTime.Now.AddYears(-200)
            ];
    }
}
