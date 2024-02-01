using EasyFinance.Domain.Models.AccessControl;

namespace EasyFinance.Server.DTOs
{
    public class UserResponseDTO
    {
        public UserResponseDTO(User user)
        {
            if (user != null)
            {
                this.Id = user.Id;
                this.Email = user.Email;
                this.FirstName = user.FirstName;
                this.LastName = user.LastName;
                this.Enabled = user.Enabled;
                this.IsFirstLogin = user.IsFirstLogin;
                this.EmailConfirmed = user.EmailConfirmed;
                this.TwoFactorEnabled = user.TwoFactorEnabled;
            }
        }

        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public bool Enabled { get; set; }
        public bool IsFirstLogin { get; set; }
        public bool EmailConfirmed { get; set; }
        public bool TwoFactorEnabled { get; set; }
    }
}
