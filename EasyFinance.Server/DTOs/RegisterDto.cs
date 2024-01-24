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
        [PasswordPropertyText]
        public string Password { get; set; }
    }
}
