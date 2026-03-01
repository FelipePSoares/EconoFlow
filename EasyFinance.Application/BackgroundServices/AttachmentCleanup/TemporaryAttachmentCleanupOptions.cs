namespace EasyFinance.Application.BackgroundServices.AttachmentCleanup
{
    public class TemporaryAttachmentCleanupOptions
    {
        public const string SectionName = "TemporaryAttachmentCleanup";

        public bool Enabled { get; set; } = true;
        public int ExpirationHours { get; set; } = 168;
        public int CleanupIntervalHours { get; set; } = 168;
        public int BatchSize { get; set; } = 500;
    }
}
