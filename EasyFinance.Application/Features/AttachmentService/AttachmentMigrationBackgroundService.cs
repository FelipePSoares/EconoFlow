using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Features.AttachmentService
{
    /// <summary>
    /// One-shot background job that migrates locally-stored attachments into the
    /// configured object storage. It runs at most once per process lifetime and only
    /// when enabled via <see cref="AttachmentMigrationOptions"/>.
    /// </summary>
    public class AttachmentMigrationBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory serviceScopeFactory;
        private readonly IOptionsMonitor<AttachmentMigrationOptions> optionsMonitor;
        private readonly ILogger<AttachmentMigrationBackgroundService> logger;

        public AttachmentMigrationBackgroundService(
            IServiceScopeFactory serviceScopeFactory,
            IOptionsMonitor<AttachmentMigrationOptions> optionsMonitor,
            ILogger<AttachmentMigrationBackgroundService> logger)
        {
            this.serviceScopeFactory = serviceScopeFactory;
            this.optionsMonitor = optionsMonitor;
            this.logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var options = this.optionsMonitor.CurrentValue;
            if (!options.Enabled)
            {
                this.logger.LogInformation("Attachment migration is disabled. Skipping.");
                return;
            }

            using var scope = this.serviceScopeFactory.CreateScope();
            var migrationService = scope.ServiceProvider.GetRequiredService<AttachmentMigrationService>();

            var result = await migrationService.MigrateAsync(stoppingToken);

            this.logger.LogInformation(
                "Attachment migration completed. Total={Total}, Migrated={Migrated}, AlreadyPresent={AlreadyPresent}, Failed={Failed}",
                result.Total, result.Migrated, result.AlreadyPresent, result.Failed);
        }
    }
}
