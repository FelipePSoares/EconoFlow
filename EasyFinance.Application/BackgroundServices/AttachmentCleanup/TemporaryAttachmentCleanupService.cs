using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.AttachmentService;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.BackgroundServices.AttachmentCleanup
{
    public class TemporaryAttachmentCleanupService : BackgroundService, ITemporaryAttachmentCleanupService
    {
        private readonly IServiceScopeFactory serviceScopeFactory;
        private readonly IOptionsMonitor<TemporaryAttachmentCleanupOptions> optionsMonitor;
        private readonly ILogger<TemporaryAttachmentCleanupService> logger;

        public TemporaryAttachmentCleanupService(
            IServiceScopeFactory serviceScopeFactory,
            IOptionsMonitor<TemporaryAttachmentCleanupOptions> optionsMonitor,
            ILogger<TemporaryAttachmentCleanupService> logger)
        {
            this.serviceScopeFactory = serviceScopeFactory;
            this.optionsMonitor = optionsMonitor;
            this.logger = logger;
        }

        public async Task<int> CleanupOnceAsync(CancellationToken cancellationToken = default)
        {
            var options = this.optionsMonitor.CurrentValue;
            if (!options.Enabled)
                return 0;

            var expirationHours = Math.Max(1, options.ExpirationHours);
            var batchSize = Math.Max(1, options.BatchSize);
            var cutoffDate = DateTime.UtcNow.AddHours(-expirationHours);

            using var scope = this.serviceScopeFactory.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var storageService = scope.ServiceProvider.GetRequiredService<IAttachmentStorageService>();

            var temporaryAttachmentsToDelete = await unitOfWork.AttachmentRepository
                .Trackable()
                .IgnoreQueryFilters()
                .Where(attachment =>
                    attachment.IsTemporary &&
                    attachment.ExpenseId == null &&
                    attachment.ExpenseItemId == null &&
                    attachment.IncomeId == null &&
                    attachment.CreatedDate <= cutoffDate)
                .OrderBy(attachment => attachment.CreatedDate)
                .Take(batchSize)
                .ToListAsync(cancellationToken);

            if (temporaryAttachmentsToDelete.Count == 0)
                return 0;

            var storageKeys = new List<string>(temporaryAttachmentsToDelete.Count);

            foreach (var temporaryAttachment in temporaryAttachmentsToDelete)
            {
                storageKeys.Add(temporaryAttachment.StorageKey);
                unitOfWork.AttachmentRepository.Delete(temporaryAttachment);
            }

            await unitOfWork.CommitAsync();

            foreach (var storageKey in storageKeys.Where(key => !string.IsNullOrWhiteSpace(key)).Distinct())
            {
                try
                {
                    await storageService.DeleteAsync(storageKey);
                }
                catch (Exception exception)
                {
                    this.logger.LogWarning(
                        exception,
                        "Failed to delete temporary attachment file during cleanup. StorageKey={StorageKey}",
                        storageKey);
                }
            }

            return temporaryAttachmentsToDelete.Count;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var cleanedCount = await CleanupOnceAsync(stoppingToken);
                    if (cleanedCount > 0)
                    {
                        this.logger.LogInformation(
                            "Temporary attachment cleanup removed {AttachmentCount} expired attachment(s).",
                            cleanedCount);
                    }
                }
                catch (Exception exception)
                {
                    this.logger.LogError(exception, "Temporary attachment cleanup execution failed.");
                }

                var options = this.optionsMonitor.CurrentValue;
                var intervalHours = Math.Max(1, options.CleanupIntervalHours);
                await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);
            }
        }
    }
}
