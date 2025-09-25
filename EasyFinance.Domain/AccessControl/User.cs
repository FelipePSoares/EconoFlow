using System;
using EasyFinance.Domain.Account;
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

        public AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (string.IsNullOrEmpty(UserName))
                    response.AddErrorMessage(nameof(UserName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(UserName)));

                if (string.IsNullOrEmpty(Email))
                    response.AddErrorMessage(nameof(Email), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Email)));

                if (string.IsNullOrEmpty(FirstName))
                    response.AddErrorMessage(nameof(FirstName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(FirstName)));

                if (string.IsNullOrEmpty(LastName))
                    response.AddErrorMessage(nameof(LastName), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(LastName)));

                if (this.NotificationChannels.HasFlag(NotificationChannels.InApp))
                    response.AddErrorMessage(nameof(NotificationChannels), string.Format(ValidationMessages.NotSupported, NotificationChannels.InApp));

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
            this.DefaultProjectId = projectId;
        }

        public void SetNotificationChannels(NotificationChannels channels)
        {
            NotificationChannels = channels;
        }
    }
}
