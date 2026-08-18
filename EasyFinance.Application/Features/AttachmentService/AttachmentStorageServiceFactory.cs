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

            if (string.Equals(settings.Provider, MinioProvider, StringComparison.OrdinalIgnoreCase))
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
    }
}
