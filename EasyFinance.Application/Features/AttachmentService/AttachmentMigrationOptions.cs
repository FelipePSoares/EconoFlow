namespace EasyFinance.Application.Features.AttachmentService
{
    public class AttachmentMigrationOptions
    {
        public const string SectionName = "AttachmentStorage:Migration";

        public bool Enabled { get; set; }
        public bool DryRun { get; set; }
        public bool VerifyOnly { get; set; }
        public int BatchSize { get; set; } = 500;
        public string Bucket { get; set; } = string.Empty;
    }
}
