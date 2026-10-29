namespace EasyFinance.Application.Features.AttachmentService
{
    /// <summary>
    /// Configuration for attachment storage. Object storage (any S3-compatible endpoint -
    /// MinIO in every current deployment) is the only backend, so these settings are
    /// required rather than an option that switches between implementations.
    /// </summary>
    public class AttachmentStorageOptions
    {
        public const string SectionName = "AttachmentStorage";

        /// <summary>
        /// Endpoint hostname of the S3-compatible service. Supplied by the <c>S3_ENDPOINT</c>
        /// environment variable.
        /// </summary>
        public string Endpoint { get; set; } = string.Empty;

        /// <summary>
        /// Access key. Supplied by the <c>S3_ACCESS_KEY</c> environment variable and never
        /// committed to the repository.
        /// </summary>
        public string AccessKey { get; set; } = string.Empty;

        /// <summary>
        /// Secret key. Supplied by the <c>S3_SECRET_KEY</c> environment variable and never
        /// committed to the repository.
        /// </summary>
        public string SecretKey { get; set; } = string.Empty;

        /// <summary>
        /// Bucket holding the attachment objects.
        /// </summary>
        public string Bucket { get; set; } = string.Empty;

        public bool UseSsl { get; set; } = true;

        public string Region { get; set; } = string.Empty;
    }
}
