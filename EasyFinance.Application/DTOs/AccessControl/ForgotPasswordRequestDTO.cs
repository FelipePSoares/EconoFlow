namespace EasyFinance.Application.DTOs.AccessControl
{
    public class ForgotPasswordRequestDTO
    {
        public string Email { get; set; } = string.Empty;
        public string CaptchaToken { get; set; } = string.Empty;
    }
}
