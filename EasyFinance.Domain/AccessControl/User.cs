using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using Microsoft.AspNetCore.Identity;

namespace EasyFinance.Domain.Models.AccessControl
{
    public class User : IdentityUser<Guid>
    {
        public User() { }

        public User(string firstName = "Default", string lastName = "Default", bool enabled = default)
        {
            this.FirstName = firstName;
            this.LastName = lastName;
            this.Enabled = enabled;
        }

        public string FirstName { get; private set; } = string.Empty;
        public string LastName { get; private set; } = string.Empty;
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
    }
}
