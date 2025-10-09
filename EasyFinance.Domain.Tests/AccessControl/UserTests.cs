using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.Shared;
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

        [Fact]
        public void AddEmail_SendUnacceptableLength_ShouldThrowException()
        {
            // Arrange
            var maxLength = PropertyMaxLengths.GetMaxLength(PropertyType.UserEmail);
            var unacceptableEmail = new string('a', maxLength + 1);
            var user = new UserBuilder().AddEmail(unacceptableEmail).Build();

            // Act
            var result = user.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be(nameof(user.Email));
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyMaxLength,
                nameof(user.Email),
                maxLength));
        }

        [Fact]
        public void AddFirstName_SendUnacceptableLength_ShouldThrowException()
        {
            // Arrange
            var maxLength = PropertyMaxLengths.GetMaxLength(PropertyType.UserFirstName);
            var unacceptableFirstName = new string('a', maxLength + 1);
            var user = new UserBuilder().AddFirstName(unacceptableFirstName).Build();

            // Act
            var result = user.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be(nameof(user.FirstName));
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyMaxLength,
                nameof(user.FirstName),
                maxLength));
        }

        [Fact]
        public void AddLastName_SendUnacceptableLength_ShouldThrowException()
        {
            // Arrange
            var maxLength = PropertyMaxLengths.GetMaxLength(PropertyType.UserLastName);
            var unacceptableLastName = new string('a', maxLength + 1);
            var user = new UserBuilder().AddLastName(unacceptableLastName).Build();

            // Act
            var result = user.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be(nameof(user.LastName));
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyMaxLength,
                nameof(user.LastName),
                maxLength));
        }
    }
}
