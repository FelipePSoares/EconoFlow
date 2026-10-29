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
    /// Health check for S3-compatible storage (Minio), the only attachment backend. Returns
    /// Healthy when the configured bucket is reachable. An incomplete S3 configuration (endpoint
    /// or bucket missing) is reported Unhealthy: there is no fallback backend, so the
    /// application could not store an attachment at all.
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
            // There is no other backend to fall back to, so an incomplete configuration is a
            // fault of the deployment rather than a configuration "not in use yet".
            if (!AttachmentStorageServiceFactory.IsS3Configured(this.storageOptions))
            {
                return HealthCheckResult.Unhealthy(
                    "S3 storage is not configured (set both S3_ENDPOINT and S3_BUCKET); attachments cannot be stored.");
            }

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
    }
}
