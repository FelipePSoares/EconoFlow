namespace EasyFinance.Application.DTOs.AccessControl
{
    public class TwoFactorEnableResponseDTO
    {
        public bool TwoFactorEnabled { get; set; }
        public string[] RecoveryCodes { get; set; } = [];
    }
}
