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
        public void AddFirstName_SendNullAndEmpty_ShouldThrowException(string firstName)
        {
            var action = () => new UserBuilder().AddFirstName(firstName).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "FirstName"))
                .And.Property.Should().Be("FirstName");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddLastName_SendNullAndEmpty_ShouldThrowException(string lastName)
        {
            var action = () => new UserBuilder().AddLastName(lastName).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "LastName"))
                .And.Property.Should().Be("LastName");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddPreferredCurrency_SendNullAndEmpty_ShouldThrowException(string preferredCurrency)
        {
            var action = () => new UserBuilder().AddPreferredCurrency(preferredCurrency).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "PreferredCurrency"))
                .And.Property.Should().Be("PreferredCurrency");
        }

        [Theory]
        [InlineData("Test")]
        public void AddPreferredCurrency_SendInvalid_ShouldThrowException(string preferredCurrency)
        {
            var action = () => new UserBuilder().AddPreferredCurrency(preferredCurrency).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(ValidationMessages.InvalidCurrencyCode)
                .And.Property.Should().Be("PreferredCurrency");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddTimezone_SendNullAndEmpty_ShouldThrowException(string timezoneId)
        {
            var action = () => new UserBuilder().AddTimezone(timezoneId).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "TimeZoneId"))
                .And.Property.Should().Be("TimeZoneId");
        }

        [Theory]
        [InlineData("Test")]
        public void AddTimezone_SendInvalid_ShouldThrowException(string timezoneId)
        {
            var action = () => new UserBuilder().AddTimezone(timezoneId).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(ValidationMessages.InvalidTimeZone)
                .And.Property.Should().Be("TimeZoneId");
        }
    }
}
