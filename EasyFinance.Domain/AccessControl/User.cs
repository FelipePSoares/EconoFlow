using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using EasyFinance.Infrastructure.Validators;
using Microsoft.AspNetCore.Identity;

namespace EasyFinance.Domain.Models.AccessControl
{
    public class User : IdentityUser<Guid>
    {
        public User() { }

        public User(string firstName = "Default", string lastName = "Default", string preferredCurrency = "EUR", string timeZoneId = "UTC", bool enabled = default)
        {
            this.FirstName = firstName;
            this.LastName = lastName;
            this.PreferredCurrency = preferredCurrency;
            this.TimeZoneId = timeZoneId;
            this.Enabled = enabled;
        }

        public string FirstName { get; private set; } = string.Empty;
        public string LastName { get; private set; } = string.Empty;
        public string PreferredCurrency { get; private set; } = string.Empty;
        public string TimeZoneId { get; private set; } = string.Empty;
        public bool Enabled { get; set; } = true;
        public bool HasIncompletedInformation => string.IsNullOrEmpty(this.FirstName) && string.IsNullOrEmpty(this.LastName);

        public void SetFirstName(string firstName)
        {
            if (string.IsNullOrEmpty(firstName))
                throw new ValidationException(nameof(this.FirstName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.FirstName)));

            this.FirstName = firstName;
        }

        public void SetLastName(string lastName)
        {
            if (string.IsNullOrEmpty(lastName))
                throw new ValidationException(nameof(this.LastName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.LastName)));

            this.LastName = lastName;
        }

        public void SetPreferredCurrency(string preferredCurrency)
        {
            if (string.IsNullOrEmpty(preferredCurrency))
                throw new ValidationException(nameof(this.PreferredCurrency), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.PreferredCurrency)));

            if (!CurrencyValidator.IsValidCurrencyCode(preferredCurrency))
                throw new ValidationException(nameof(this.PreferredCurrency), ValidationMessages.InvalidCurrencyCode);

            this.PreferredCurrency = preferredCurrency;
        }

        public void SetTimezone(string timeZoneId)
        {
            if (string.IsNullOrEmpty(timeZoneId))
                throw new ValidationException(nameof(this.TimeZoneId), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.TimeZoneId)));

            if (TimeZoneValidator.TryGetTimeZoneInfo(timeZoneId, out var timeZoneInfo))
                this.TimeZoneId = timeZoneInfo.Id;
            else
                throw new ValidationException(nameof(this.TimeZoneId), ValidationMessages.InvalidTimeZone);
        }
    }
}
