using System.ComponentModel;
using System.ComponentModel.DataAnnotations;

namespace EasyFinance.Server.DTOs
{
    public class RegisterDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; }
        [Required]
        [EmailAddress]
        public string EmailConfirm { get; set; }

        [Required]
        [PasswordPropertyText]
        public string Password { get; set; }

        public bool _isEmailConfirmed => Email.Equals(EmailConfirm);
    }
}
