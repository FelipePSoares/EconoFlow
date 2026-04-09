namespace EasyFinance.Application.DTOs.AccessControl
{
    public class LoginFailureResponseDTO
    {
        public string Code { get; set; } = string.Empty;
        public bool RequiresTwoFactor { get; set; }
        public bool RequiresCaptcha { get; set; }
    }
}
