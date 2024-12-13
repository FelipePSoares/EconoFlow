using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using EasyFinance.Infrastructure.Validators;
using Microsoft.AspNetCore.Identity;
using System.Net.Mail;

namespace EasyFinance.Domain.AccessControl
{
    public class User : IdentityUser<Guid>
    {
        public User() { }

        public User(string firstName = "Default", string lastName = "Default", string preferredCurrency = "EUR", string timeZoneId = "UTC", bool enabled = default)
        {
            FirstName = firstName;
            LastName = lastName;
            PreferredCurrency = preferredCurrency;
            TimeZoneId = timeZoneId;
            Enabled = enabled;
        }

        public string FirstName { get; private set; } = string.Empty;
        public string LastName { get; private set; } = string.Empty;
        public string PreferredCurrency { get; private set; } = string.Empty;
        public string TimeZoneId { get; private set; } = string.Empty;
        public bool Enabled { get; set; } = true;
        public bool HasIncompletedInformation => string.IsNullOrEmpty(FirstName) && string.IsNullOrEmpty(LastName);

        public void SetFirstName(string firstName)
        {
            if (string.IsNullOrEmpty(firstName))
                throw new ValidationException(nameof(FirstName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(FirstName)));

            FirstName = firstName;
        }

        public void SetLastName(string lastName)
        {
            if (string.IsNullOrEmpty(lastName))
                throw new ValidationException(nameof(LastName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(LastName)));

            LastName = lastName;
        }

        public void SetPreferredCurrency(string preferredCurrency)
        {
            if (string.IsNullOrEmpty(preferredCurrency))
                throw new ValidationException(nameof(PreferredCurrency), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(PreferredCurrency)));

            if (!CurrencyValidator.IsValidCurrencyCode(preferredCurrency))
                throw new ValidationException(nameof(PreferredCurrency), ValidationMessages.InvalidCurrencyCode);

            PreferredCurrency = preferredCurrency;
        }

        public void SetTimezone(string timeZoneId)
        {
            if (string.IsNullOrEmpty(timeZoneId))
                throw new ValidationException(nameof(TimeZoneId), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(TimeZoneId)));

            if (TimeZoneValidator.TryGetTimeZoneInfo(timeZoneId, out var timeZoneInfo))
                TimeZoneId = timeZoneInfo.Id;
            else
                throw new ValidationException(nameof(TimeZoneId), ValidationMessages.InvalidTimeZone);
        }
    }
}
