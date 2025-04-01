using System;
using EasyFinance.Domain.AccessControl;

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
                SubscriptionLevel = user.SubscriptionLevel;
            }
        }

        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public bool Enabled { get; set; }
        public bool IsFirstLogin { get; set; }
        public bool EmailConfirmed { get; set; }
        public bool TwoFactorEnabled { get; set; }
        public Guid? DefaultProjectId {  get; set; }
        public SubscriptionLevels SubscriptionLevel { get; private set; } = SubscriptionLevels.Free;
    }
}
