namespace EasyFinance.Application.DTOs.BackgroundService.Notification
{
    public class WebPushPayload
    {
        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string Tag { get; set; } = string.Empty;
        public bool RequireInteraction { get; set; }
        public string Icon { get; set; } = string.Empty;
        public string Badge { get; set; } = string.Empty;
        public WebPushPayloadData Data { get; set; } = new();

        // Backward-compatible alias used by legacy callers.
        public string Url
        {
            get => Data.Url;
            set => Data.Url = string.IsNullOrWhiteSpace(value) ? "/" : value;
        }
    }

    public class WebPushPayloadData
    {
        public string Url { get; set; } = "/";
    }
}
