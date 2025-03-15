using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Infrastructure.Exceptions;
using Microsoft.AspNetCore.Identity;

namespace EasyFinance.Domain.AccessControl
{
    public class User : IdentityUser<Guid>
    {
        public User() { }

        public User(Guid id)
        {
            Id = id;
        }

        public User(string firstName = "Default", string lastName = "Default", bool enabled = default)
        {
            FirstName = firstName;
            LastName = lastName;
            Enabled = enabled;
        }

        public string FirstName { get; private set; } = string.Empty;
        public string LastName { get; private set; } = string.Empty;
        public string FullName => $"{FirstName} {LastName}";
        public bool Enabled { get; set; } = true;
        public bool HasIncompletedInformation => string.IsNullOrEmpty(FirstName) && string.IsNullOrEmpty(LastName);
        public Guid? DefaultProjectId { get; private set; } = default;

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

        public AppResponse SetDefaultProject(Guid? projectId)
        {
            this.DefaultProjectId = projectId;

            return AppResponse.Success();
        }
    }
}
