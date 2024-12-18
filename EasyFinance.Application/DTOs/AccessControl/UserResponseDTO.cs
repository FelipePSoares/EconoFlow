using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.Validators;
using System;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class UserResponseDTO
    {
        public UserResponseDTO(User user)
        {
            TimeZoneValidator.TryGetTimeZoneInfo(user.TimeZoneId, out var timeZoneInfo);

            if (user != null)
            {
                Id = user.Id;
                Email = user.Email;
                FirstName = user.FirstName;
                LastName = user.LastName;
                PreferredCurrency = user.PreferredCurrency;
                TimeZone = timeZoneInfo;
                Enabled = user.Enabled;
                IsFirstLogin = user.HasIncompletedInformation;
                EmailConfirmed = user.EmailConfirmed;
                TwoFactorEnabled = user.TwoFactorEnabled;
            }
        }

        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string PreferredCurrency { get; set; } = string.Empty;
        public TimeZoneInfo TimeZone { get; set; }
        public bool Enabled { get; set; }
        public bool IsFirstLogin { get; set; }
        public bool EmailConfirmed { get; set; }
        public bool TwoFactorEnabled { get; set; }
    }
}
