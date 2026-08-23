using System;
using System.IO;
using System.Threading.Tasks;
using EasyFinance.Domain.Shared;

namespace EasyFinance.Application.Features.AttachmentService
{
    public class MinioAttachmentStorageService : IAttachmentStorageService
    {
        private readonly IMinioS3Client minioClient;
        private readonly string bucket;

        public MinioAttachmentStorageService(IMinioS3Client minioClient, string bucket)
        {
            this.minioClient = minioClient ?? throw new ArgumentNullException(nameof(minioClient));
            this.bucket = string.IsNullOrWhiteSpace(bucket)
                ? throw new ArgumentException("Bucket name is required.", nameof(bucket))
                : bucket;

            this.minioClient.EnsureBucketExistsAsync(this.bucket).GetAwaiter().GetResult();
        }

        public async Task<string> SaveAsync(Stream content, string fileName)
        {
            ArgumentNullException.ThrowIfNull(content);

            var extension = Path.GetExtension(fileName);
            var storageKey = $"{SystemClock.UtcNow:yyyy/MM/dd}/{Guid.NewGuid():N}{extension}";

            var contentType = string.IsNullOrWhiteSpace(extension)
                ? "application/octet-stream"
                : MimeTypeFromExtension(extension);

            await this.minioClient.PutObjectAsync(this.bucket, storageKey, content, content.Length, contentType);

            return storageKey;
        }

        public async Task<Stream> OpenReadAsync(string storageKey)
        {
            if (string.IsNullOrWhiteSpace(storageKey))
                throw new ArgumentException("Storage key is required.", nameof(storageKey));

            try
            {
                return await this.minioClient.GetObjectAsync(this.bucket, storageKey);
            }
            catch (MinioObjectNotFoundException)
            {
                throw new FileNotFoundException("Attachment file not found in storage.", storageKey);
            }
        }

        public async Task DeleteAsync(string storageKey)
        {
            if (string.IsNullOrWhiteSpace(storageKey))
                return;

            await this.minioClient.RemoveObjectAsync(this.bucket, storageKey);
        }

        private static string MimeTypeFromExtension(string extension)
        {
            return extension.ToLowerInvariant() switch
            {
                ".pdf" => "application/pdf",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                ".heic" => "image/heic",
                ".heif" => "image/heif",
                _ => "application/octet-stream",
            };
        }
    }
}
