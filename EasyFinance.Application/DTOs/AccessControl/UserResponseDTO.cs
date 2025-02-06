using System;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Mappers;
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
                PreferredCurrency = user.PreferredCurrency;
                Enabled = user.Enabled;
                IsFirstLogin = user.HasIncompletedInformation;
                EmailConfirmed = user.EmailConfirmed;
                TwoFactorEnabled = user.TwoFactorEnabled;
                DefaultProject = user.DefaultProject != null ? user.DefaultProject.ToDTO() : new ProjectResponseDTO();
            }
        }

        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string PreferredCurrency { get; set; } = string.Empty;
        public bool Enabled { get; set; }
        public bool IsFirstLogin { get; set; }
        public bool EmailConfirmed { get; set; }
        public bool TwoFactorEnabled { get; set; }
        public ProjectResponseDTO DefaultProject {  get; set; } = new ProjectResponseDTO();
    }
}
