using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using EasyFinance.Infrastructure.Validators;
using Microsoft.AspNetCore.Identity;
using System.Net.Mail;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain.AccessControl
{
    public class User : IdentityUser<Guid>
    {
        public User() { }

        public User(string firstName = "Default", string lastName = "Default", string preferredCurrency = "EUR", bool enabled = default)
        {
            FirstName = firstName;
            LastName = lastName;
            PreferredCurrency = preferredCurrency;
            Enabled = enabled;
        }

        public string FirstName { get; private set; } = string.Empty;
        public string LastName { get; private set; } = string.Empty;
        public string PreferredCurrency { get; private set; } = string.Empty;
        public bool Enabled { get; set; } = true;
        public bool HasIncompletedInformation => string.IsNullOrEmpty(FirstName) && string.IsNullOrEmpty(LastName);
        public Project DefaultProject { get; private set; } = default;

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

        public AppResponse SetDefaultProject(Project project)
        {
            if (project == default)
                return AppResponse.Error(nameof(project), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.DefaultProject)));

            this.DefaultProject = project;

            return AppResponse.Success();
        }
    }
}
