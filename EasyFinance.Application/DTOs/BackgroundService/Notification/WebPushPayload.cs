namespace EasyFinance.Application.DTOs.BackgroundService.Notification
{
    public class WebPushPayload
    {
        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string Url { get; set; } = "/";
        public string Tag { get; set; } = string.Empty;
        public bool RequireInteraction { get; set; }
        public string Icon { get; set; } = string.Empty;
        public string Badge { get; set; } = string.Empty;
    }
}
