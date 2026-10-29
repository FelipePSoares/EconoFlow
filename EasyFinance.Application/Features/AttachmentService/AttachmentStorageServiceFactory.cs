using System;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Features.AttachmentService
{
    /// <summary>
    /// Creates the attachment storage. Object storage is the only backend: there is no
    /// fallback, so a missing or partial configuration throws at creation time (during
    /// start-up) instead of deferring the failure to the first upload - or silently writing
    /// attachments to the container's own disk, which the next deploy discards.
    /// </summary>
    public static class AttachmentStorageServiceFactory
    {
        public static IAttachmentStorageService Create(
            IOptions<AttachmentStorageOptions> options,
            Func<IMinioS3Client> minioClientFactory)
        {
            var settings = options?.Value ?? new AttachmentStorageOptions();

            if (string.IsNullOrWhiteSpace(settings.Endpoint))
                throw new InvalidOperationException(
                    "Attachment storage requires an S3 endpoint (set S3_ENDPOINT). Object storage is the only attachment backend.");

            if (string.IsNullOrWhiteSpace(settings.Bucket))
                throw new InvalidOperationException(
                    "Attachment storage requires a bucket name (set S3_BUCKET). Object storage is the only attachment backend.");

            var client = minioClientFactory?.Invoke()
                ?? throw new InvalidOperationException(
                    "A Minio client factory is required to create attachment storage.");

            return new MinioAttachmentStorageService(client, settings.Bucket);
        }

        /// <summary>
        /// Whether the S3 settings an attachment write needs are present. Partial configuration
        /// is not "almost configured": without both values no object can be stored, which the
        /// readiness probe reports and startup refuses.
        /// </summary>
        public static bool IsS3Configured(AttachmentStorageOptions settings)
        {
            if (settings == null)
                return false;

            return !string.IsNullOrWhiteSpace(settings.Endpoint)
                   && !string.IsNullOrWhiteSpace(settings.Bucket);
        }
    }
}
