using System;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class UserResponseDTO
    {
        public UserResponseDTO(User user)
        {
            if (user != null)
            {
                Id = user.Id;
                Email = user.Email;
                FirstName = user.FirstName;
                LastName = user.LastName;
                FullName = user.FullName;
                Enabled = user.Enabled;
                IsFirstLogin = user.HasIncompletedInformation;
                EmailConfirmed = user.EmailConfirmed;
                TwoFactorEnabled = user.TwoFactorEnabled;
                DefaultProjectId = user.DefaultProjectId;
                NotificationChannels = user.NotificationChannels;
                LanguageCode = user.LanguageCode;
            }
        }

        public Guid Id { get; init; }
        public string Email { get; init; } = string.Empty;
        public string FirstName { get; init; } = string.Empty;
        public string LastName { get; init; } = string.Empty;
        public string FullName { get; init; } = string.Empty;
        public bool Enabled { get; init; }
        public bool IsFirstLogin { get; init; }
        public bool EmailConfirmed { get; init; }
        public bool TwoFactorEnabled { get; init; }
        public Guid? DefaultProjectId {  get; init; }
        public NotificationChannels NotificationChannels { get; init; }
        public string LanguageCode { get; init; }
    }
}
