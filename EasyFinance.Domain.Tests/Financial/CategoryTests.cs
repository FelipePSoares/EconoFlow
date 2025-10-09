using EasyFinance.Common.Tests.Financial;
using EasyFinance.Domain.Shared;
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
        public void AddName_SendUnacceptableLength_ShouldThrowException()
        {
            // Arrange
            var maxLength = PropertyMaxLengths.GetMaxLength(PropertyType.CategoryName);
            var unacceptableName = new string('a', maxLength + 1);
            var category = new CategoryBuilder().AddName(unacceptableName).Build();

            // Act
            var result = category.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be(nameof(category.Name));
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyMaxLength,
                nameof(category.Name),
                maxLength));
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
