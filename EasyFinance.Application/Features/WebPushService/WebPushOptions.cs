namespace EasyFinance.Application.Features.WebPushService
{
    public class WebPushOptions
    {
        public const string SectionName = "WebPush";

        public bool AppPushConfigured { get; set; }
        public string Subject { get; set; } = "mailto:support@econoflow.pt";
        public string PublicKey { get; set; } = string.Empty;
        public string PrivateKey { get; set; } = string.Empty;
    }
}
