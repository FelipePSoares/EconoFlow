using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Infrastructure;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.AccessControl
{
    public class UserTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddFirstName_SendNullAndEmpty_ShouldThrowException(string firstName)
        {
            // Arrange
            var user = new UserBuilder().AddFirstName(firstName).Build();

            // Act
            var result = user.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("FirstName");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "FirstName"));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddLastName_SendNullAndEmpty_ShouldThrowException(string lastName)
        {
            // Arrange
            var user = new UserBuilder().AddLastName(lastName).Build();

            // Act
            var result = user.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("LastName");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "LastName"));
        }
    }
}
