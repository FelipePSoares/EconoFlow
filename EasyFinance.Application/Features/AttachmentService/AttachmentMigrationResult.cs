namespace EasyFinance.Application.Features.AttachmentService
{
    public class AttachmentMigrationResult
    {
        public int Total { get; set; }
        public int Migrated { get; set; }
        public int AlreadyPresent { get; set; }
        public int Failed { get; set; }
    }
}
