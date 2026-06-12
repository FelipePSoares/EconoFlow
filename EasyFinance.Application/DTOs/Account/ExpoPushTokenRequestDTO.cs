namespace EasyFinance.Application.DTOs.Account
{
    public class ExpoPushTokenRequestDTO
    {
        public string Token { get; set; } = string.Empty;
        public string? DeviceName { get; set; }
    }
}
