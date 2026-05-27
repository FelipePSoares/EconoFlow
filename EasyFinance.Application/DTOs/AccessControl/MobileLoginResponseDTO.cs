namespace EasyFinance.Application.DTOs.AccessControl
{
    public class MobileLoginResponseDTO
    {
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
    }
}
