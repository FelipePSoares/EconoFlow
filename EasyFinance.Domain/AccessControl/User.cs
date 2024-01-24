using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using Microsoft.AspNetCore.Identity;

namespace EasyFinance.Domain.Models.AccessControl
{
    public class User : IdentityUser
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
        public bool Enabled { get; private set; }

        public void SetFirstName(string firstName)
        {
            this.FirstName = firstName;

            if (string.IsNullOrEmpty(this.FirstName))
                throw new ValidationException(nameof(this.FirstName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.FirstName)));
        }

        public void SetLastName(string lastName)
        {
            this.LastName = lastName;

            if (string.IsNullOrEmpty(this.LastName))
                throw new ValidationException(nameof(this.LastName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.LastName)));
        }

        public void SetEnabled(bool enabled)
        {
            this.Enabled = enabled;
        }
    }
}
