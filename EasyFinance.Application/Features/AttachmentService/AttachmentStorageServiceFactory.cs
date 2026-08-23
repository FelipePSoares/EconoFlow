using System;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Features.AttachmentService
{
    public static class AttachmentStorageServiceFactory
    {
        public const string FileSystemProvider = "FileSystem";
        public const string MinioProvider = "Minio";

        public static IAttachmentStorageService Create(
            IOptions<AttachmentStorageOptions> options,
            Func<IMinioS3Client> minioClientFactory)
        {
            var settings = options?.Value ?? new AttachmentStorageOptions();

            if (IsMinioConfigured(settings))
            {
                if (string.IsNullOrWhiteSpace(settings.Bucket))
                    throw new InvalidOperationException("Attachment storage bucket name is required when using the Minio provider.");

                var client = minioClientFactory?.Invoke()
                    ?? throw new InvalidOperationException("A Minio client factory is required when using the Minio provider.");

                return new MinioAttachmentStorageService(client, settings.Bucket);
            }

            if (string.Equals(settings.Provider, FileSystemProvider, StringComparison.OrdinalIgnoreCase)
                || string.IsNullOrWhiteSpace(settings.Provider))
            {
                return new FileSystemAttachmentStorageService();
            }

            throw new InvalidOperationException($"Unknown attachment storage provider '{settings.Provider}'.");
        }

        /// <summary>
        /// The Minio provider is used when explicitly configured, or when the storage
        /// is still the default (FileSystem) but an S3 endpoint and bucket are present.
        /// The latter lets S3 configuration (S3_ENDPOINT / S3_BUCKET) activate Minio
        /// without an explicit AttachmentStorage__Provider override.
        /// </summary>
        public static bool IsMinioConfigured(AttachmentStorageOptions settings)
        {
            if (settings == null)
                return false;

            if (string.Equals(settings.Provider, MinioProvider, StringComparison.OrdinalIgnoreCase))
                return true;

            return (string.IsNullOrWhiteSpace(settings.Provider)
                    || string.Equals(settings.Provider, FileSystemProvider, StringComparison.OrdinalIgnoreCase))
                   && !string.IsNullOrWhiteSpace(settings.Endpoint)
                   && !string.IsNullOrWhiteSpace(settings.Bucket);
        }
    }
}
