using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Features.AttachmentService
{
    public class AttachmentMigrationService
    {
        private readonly IUnitOfWork unitOfWork;
        private readonly FileSystemAttachmentStorageService source;
        private readonly IMinioS3Client destination;
        private readonly IOptions<AttachmentMigrationOptions> options;
        private readonly ILogger<AttachmentMigrationService> logger;

        public AttachmentMigrationService(
            IUnitOfWork unitOfWork,
            FileSystemAttachmentStorageService source,
            IMinioS3Client destination,
            IOptions<AttachmentMigrationOptions> options,
            ILogger<AttachmentMigrationService> logger)
        {
            this.unitOfWork = unitOfWork;
            this.source = source;
            this.destination = destination;
            this.options = options;
            this.logger = logger;
        }

        public async Task<AttachmentMigrationResult> MigrateAsync(CancellationToken cancellationToken = default)
        {
            var settings = this.options?.Value ?? new AttachmentMigrationOptions();
            if (!settings.Enabled)
                return new AttachmentMigrationResult();

            var batchSize = Math.Max(1, settings.BatchSize);
            var result = new AttachmentMigrationResult();

            var attachments = this.unitOfWork.AttachmentRepository
                .NoTrackable()
                .Where(attachment => !string.IsNullOrWhiteSpace(attachment.StorageKey))
                .OrderBy(attachment => attachment.CreatedDate)
                .Take(batchSize)
                .ToList();

            result.Total = attachments.Count;

            foreach (var attachment in attachments)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var key = attachment.StorageKey;

                try
                {
                    if (await ExistsInDestinationAsync(key, cancellationToken))
                    {
                        result.AlreadyPresent++;
                        continue;
                    }

                    if (settings.DryRun)
                    {
                        result.Migrated++;
                        continue;
                    }

                    await using var stream = await this.source.OpenReadAsync(key);
                    await this.destination.PutObjectAsync(
                        settings.Bucket,
                        key,
                        stream,
                        attachment.Size,
                        attachment.ContentType);
                    result.Migrated++;
                }
                catch (Exception exception)
                {
                    result.Failed++;
                    this.logger.LogWarning(exception, "Failed to migrate attachment. StorageKey={StorageKey}", key);
                }
            }

            return result;
        }

        private async Task<bool> ExistsInDestinationAsync(string key, CancellationToken cancellationToken)
        {
            var settings = this.options?.Value ?? new AttachmentMigrationOptions();
            try
            {
                await using var stream = await this.destination.GetObjectAsync(settings.Bucket, key);
                return true;
            }
            catch (FileNotFoundException)
            {
                return false;
            }
            catch (MinioObjectNotFoundException)
            {
                return false;
            }
        }
    }
}
