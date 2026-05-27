namespace EasyFinance.Application.DTOs.AccessControl
{
    public class MobileRefreshRequestDTO
    {
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
    }
}
