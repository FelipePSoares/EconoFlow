namespace EasyFinance.Application.Features.ExpoPushTokenService
{
    public class ExpoMessage
    {
        public string To { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string? Body { get; set; }
        public object? Data { get; set; }
        public string Sound { get; set; } = "default";
        public string Priority { get; set; } = "high";
    }
}
