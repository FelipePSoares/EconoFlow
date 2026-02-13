using System;
using System.ComponentModel.DataAnnotations.Schema;
using System.Globalization;
using System.Linq;
using EasyFinance.Domain.Account;
using EasyFinance.Domain.Shared;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
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

        public User(
            string firstName = "Default",
            string lastName = "Default",
            bool enabled = true,
            NotificationChannels notificationChannels = NotificationChannels.Email | NotificationChannels.Push)
        {
            FirstName = firstName;
            LastName = lastName;
            Enabled = enabled;
            NotificationChannels = notificationChannels;
        }

        public string FirstName { get; private set; } = string.Empty;
        public string LastName { get; private set; } = string.Empty;
        public string FullName => $"{FirstName} {LastName}";
        public bool Enabled { get; set; } = true;
        public bool HasIncompletedInformation => string.IsNullOrEmpty(FirstName) || string.IsNullOrEmpty(LastName);
        public Guid? DefaultProjectId { get; private set; } = default;
        public NotificationChannels NotificationChannels { get; private set; } = NotificationChannels.None;
        public string LanguageCode { get; private set; } = "en-US";

        [NotMapped]
        public CultureInfo Culture => new (LanguageCode);

        public AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (string.IsNullOrEmpty(UserName))
                    response.AddErrorMessage(nameof(UserName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(UserName)));

                if (string.IsNullOrEmpty(Email))
                    response.AddErrorMessage(nameof(Email), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Email)));

                if (!string.IsNullOrEmpty(Email) && Email.Length > PropertyMaxLengths.GetMaxLength(PropertyType.UserEmail))
                    response.AddErrorMessage(nameof(Email),
                        string.Format(ValidationMessages.PropertyMaxLength,
                        nameof(Email),
                        PropertyMaxLengths.GetMaxLength(PropertyType.UserEmail)));

                if (string.IsNullOrEmpty(FirstName))
                    response.AddErrorMessage(nameof(FirstName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(FirstName)));
                
                if (!string.IsNullOrEmpty(FirstName) && FirstName.Length > PropertyMaxLengths.GetMaxLength(PropertyType.UserFirstName))
                    response.AddErrorMessage(nameof(FirstName),
                        string.Format(ValidationMessages.PropertyMaxLength,
                        nameof(FirstName),
                        PropertyMaxLengths.GetMaxLength(PropertyType.UserFirstName)));

                if (string.IsNullOrEmpty(LastName))
                    response.AddErrorMessage(nameof(LastName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(LastName)));
                
                if (!string.IsNullOrEmpty(LastName) && LastName.Length > PropertyMaxLengths.GetMaxLength(PropertyType.UserLastName))
                    response.AddErrorMessage(nameof(LastName),
                        string.Format(ValidationMessages.PropertyMaxLength,
                        nameof(LastName),
                        PropertyMaxLengths.GetMaxLength(PropertyType.UserLastName)));

                if (this.NotificationChannels.HasFlag(NotificationChannels.InApp))
                    response.AddErrorMessage(nameof(NotificationChannels), string.Format(ValidationMessages.NotSupported, NotificationChannels.InApp));

                if (string.IsNullOrEmpty(this.LanguageCode))
                    response.AddErrorMessage(nameof(LanguageCode), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(LanguageCode)));

                if (!CultureInfo.GetCultures(CultureTypes.AllCultures).Any(culture => string.Equals(culture.Name, this.LanguageCode, StringComparison.CurrentCultureIgnoreCase)))
                    response.AddErrorMessage(nameof(LanguageCode), ValidationMessages.InvalidCultureCode);

                return response;
            }
        }

        public void SetFirstName(string firstName)
        {
            FirstName = firstName;
        }

        public void SetLastName(string lastName)
        {
            LastName = lastName;
        }

        public void SetDefaultProject(Guid? projectId)
        {
            DefaultProjectId = projectId;
        }

        public void SetNotificationChannels(NotificationChannels channels)
        {
            NotificationChannels = channels;
        }

        public void SetLanguageCode(string culture)
        {
            LanguageCode = culture;
        }
    }
}
