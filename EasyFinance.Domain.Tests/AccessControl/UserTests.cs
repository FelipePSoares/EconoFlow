using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.AccessControl
{
    public class UserTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void ValidateFirstNameNullOrEmpty(string firstName)
        {
            var action = () => new UserBuilder().AddFirstName(firstName).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "FirstName"))
                .And.Property.Should().Be("FirstName");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void ValidateLastNameNullOrEmpty(string lastName)
        {
            var action = () => new UserBuilder().AddLastName(lastName).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "LastName"))
                .And.Property.Should().Be("LastName");
        }
    }
}
