using System;
using Minio;

namespace EasyFinance.Application.Features.AttachmentService
{
    public static class MinioClientFactory
    {
        public static IMinioS3Client CreateS3Client(AttachmentStorageOptions settings)
        {
            if (settings == null)
                throw new ArgumentNullException(nameof(settings));

            if (string.IsNullOrWhiteSpace(settings.Endpoint))
                throw new InvalidOperationException("The S3 endpoint is required when using the Minio provider.");

            var endpoint = NormalizeEndpoint(settings.Endpoint);

            IMinioClient minioClient = new MinioClient()
                .WithEndpoint(endpoint)
                .WithCredentials(
                    settings.AccessKey ?? string.Empty,
                    settings.SecretKey ?? string.Empty)
                .WithSSL(settings.UseSsl);

            if (!string.IsNullOrWhiteSpace(settings.Region))
                minioClient = minioClient.WithRegion(settings.Region);

            return new MinioS3ClientAdapter(minioClient.Build());
        }

        public static string NormalizeEndpoint(string endpoint)
        {
            if (endpoint.Contains("://", StringComparison.OrdinalIgnoreCase))
                return new Uri(endpoint).Host;

            return endpoint;
        }
    }
}
