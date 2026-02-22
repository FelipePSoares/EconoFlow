namespace EasyFinance.Application.DTOs.AccessControl
{
    public class TwoFactorSecureActionRequestDTO
    {
        public string Password { get; set; } = string.Empty;
        public string TwoFactorCode { get; set; } = string.Empty;
        public string TwoFactorRecoveryCode { get; set; } = string.Empty;
    }
}
