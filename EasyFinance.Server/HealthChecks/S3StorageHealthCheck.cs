using System;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.Features.AttachmentService;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace EasyFinance.Server.HealthChecks
{
    /// <summary>
    /// Health check for S3-compatible storage (Minio). Returns Healthy when the
    /// configured storage provider is <see cref="AttachmentStorageServiceFactory.FileSystemProvider"/>
    /// (no external dependency) and when the S3 bucket is reachable for the Minio provider.
    /// </summary>
    public class S3StorageHealthCheck : IHealthCheck
    {
        private readonly IServiceProvider serviceProvider;
        private readonly AttachmentStorageOptions storageOptions;

        public S3StorageHealthCheck(
            IServiceProvider serviceProvider,
            IOptions<AttachmentStorageOptions> options)
        {
            this.serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
            this.storageOptions = options?.Value ?? throw new ArgumentNullException(nameof(options));
        }

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            var provider = this.storageOptions.Provider;

            if (string.IsNullOrWhiteSpace(provider)
                || string.Equals(provider, AttachmentStorageServiceFactory.FileSystemProvider, StringComparison.OrdinalIgnoreCase))
            {
                return HealthCheckResult.Healthy("File system storage provider in use; no S3 dependency to check.");
            }

            if (string.Equals(provider, AttachmentStorageServiceFactory.MinioProvider, StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(this.storageOptions.Bucket))
                    return HealthCheckResult.Unhealthy("S3 storage provider is configured but the bucket is not set.");

                try
                {
                    var minioS3Client = this.serviceProvider.GetRequiredService<IMinioS3Client>();
                    await minioS3Client.EnsureBucketExistsAsync(this.storageOptions.Bucket);
                    return HealthCheckResult.Healthy("S3 storage is reachable.");
                }
                catch (Exception ex)
                {
                    return HealthCheckResult.Unhealthy($"S3 storage is unreachable: {ex.Message}", ex);
                }
            }

            return HealthCheckResult.Unhealthy($"Unknown attachment storage provider '{provider}'.");
        }
    }
}
