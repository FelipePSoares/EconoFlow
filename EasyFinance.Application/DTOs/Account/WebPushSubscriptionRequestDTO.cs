using EasyFinance.Domain.Account;

namespace EasyFinance.Application.DTOs.Account
{
    public class WebPushSubscriptionRequestDTO
    {
        public string Endpoint { get; set; } = string.Empty;
        public string P256dh { get; set; } = string.Empty;
        public string Auth { get; set; } = string.Empty;
        public string UserAgent { get; set; } = string.Empty;
        public WebPushDeviceType DeviceType { get; set; } = WebPushDeviceType.Browser;
        public string PermissionStatus { get; set; } = string.Empty;
    }
}
