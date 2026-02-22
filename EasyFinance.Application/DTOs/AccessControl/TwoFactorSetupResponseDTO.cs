namespace EasyFinance.Application.DTOs.AccessControl
{
    public class TwoFactorSetupResponseDTO
    {
        public bool IsTwoFactorEnabled { get; set; }
        public string SharedKey { get; set; } = string.Empty;
        public string OtpAuthUri { get; set; } = string.Empty;
    }
}
