namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService
{
    public class NotifierFallbackOptions
    {
        public const string SectionName = "NotificationFallback";

        public int IntervalSeconds { get; set; } = 30;
        public int BatchSize { get; set; } = 50;
        public int LeaseDurationSeconds { get; set; } = 120;
    }
}
