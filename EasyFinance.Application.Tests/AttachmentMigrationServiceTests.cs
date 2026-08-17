using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Domain.Financial;
using FluentAssertions;
using Moq;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.Tests
{
    public class AttachmentMigrationServiceTests
    {
        private readonly Mock<IUnitOfWork> unitOfWork = new();
        private readonly Mock<IMinioS3Client> destination = new();
        private readonly Mock<ILogger<AttachmentMigrationService>> logger = new();
        private readonly string sourceRoot = Path.Combine(Path.GetTempPath(), $"econoflow-migrate-{Guid.NewGuid():N}");
        private readonly FileSystemAttachmentStorageService source;

        public AttachmentMigrationServiceTests()
        {
            Directory.CreateDirectory(this.sourceRoot);
            Environment.SetEnvironmentVariable("EconoFlow_ATTACHMENTS_ROOT_PATH", this.sourceRoot);
            this.source = new FileSystemAttachmentStorageService();
        }

        private AttachmentMigrationService CreateService(AttachmentMigrationOptions options) =>
            new(this.unitOfWork.Object, this.source, this.destination.Object, Microsoft.Extensions.Options.Options.Create(options), this.logger.Object);

        private static List<Attachment> Attachments(params string[] keys) =>
            keys.Select(key => new Attachment(
                name: "a.pdf",
                contentType: "application/pdf",
                size: 4,
                storageKey: key,
                expenseId: Guid.NewGuid())).ToList();

        [Fact]
        public async Task MigrateAsync_ShouldCopyMissingFilesAndSkipExisting()
        {
            SeedFile("2025/01/15/one.pdf");
            SeedFile("2025/01/15/two.pdf");

            // one.pdf: missing from destination -> migrated
            this.destination
                .Setup(d => d.GetObjectAsync("test-bucket", "2025/01/15/one.pdf"))
                .ThrowsAsync(new MinioObjectNotFoundException("2025/01/15/one.pdf"));

            // two.pdf: already present -> skipped
            this.destination
                .Setup(d => d.GetObjectAsync("test-bucket", "2025/01/15/two.pdf"))
                .ReturnsAsync(Stream.Null);

            this.unitOfWork
                .Setup(u => u.AttachmentRepository.NoTrackable())
                .Returns(Attachments("2025/01/15/one.pdf", "2025/01/15/two.pdf").AsQueryable());

            var result = await CreateService(new AttachmentMigrationOptions { Enabled = true, BatchSize = 10, Bucket = "test-bucket" })
                .MigrateAsync();

            result.Total.Should().Be(2);
            result.Migrated.Should().Be(1);
            result.AlreadyPresent.Should().Be(1);
            result.Failed.Should().Be(0);

            // key must be preserved exactly (not regenerated)
            this.destination.Verify(d => d.PutObjectAsync(
                "test-bucket",
                "2025/01/15/one.pdf",
                It.IsAny<Stream>(),
                4,
                "application/pdf"), Times.Once);
        }

        [Fact]
        public async Task MigrateAsync_WhenDryRun_ShouldNotCopyAnything()
        {
            SeedFile("2025/01/15/one.pdf");
            this.destination
                .Setup(d => d.GetObjectAsync("test-bucket", "2025/01/15/one.pdf"))
                .ThrowsAsync(new MinioObjectNotFoundException("2025/01/15/one.pdf"));

            this.unitOfWork
                .Setup(u => u.AttachmentRepository.NoTrackable())
                .Returns(Attachments("2025/01/15/one.pdf").AsQueryable());

            var result = await CreateService(new AttachmentMigrationOptions { Enabled = true, DryRun = true, BatchSize = 10, Bucket = "test-bucket" })
                .MigrateAsync();

            result.Migrated.Should().Be(1);
            result.Failed.Should().Be(0);
            this.destination.Verify(d => d.PutObjectAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<long>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task MigrateAsync_ShouldContinueAfterIndividualFailure()
        {
            SeedFile("2025/01/15/good.pdf");
            // "bad.pdf" is NOT seeded -> source.OpenReadAsync throws FileNotFound
            this.destination
                .Setup(d => d.GetObjectAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ThrowsAsync(new MinioObjectNotFoundException("missing"));

            this.unitOfWork
                .Setup(u => u.AttachmentRepository.NoTrackable())
                .Returns(Attachments("2025/01/15/bad.pdf", "2025/01/15/good.pdf").AsQueryable());

            var result = await CreateService(new AttachmentMigrationOptions { Enabled = true, BatchSize = 10, Bucket = "test-bucket" })
                .MigrateAsync();

            result.Failed.Should().Be(1);
            result.Migrated.Should().Be(1);
        }

        [Fact]
        public async Task MigrateAsync_WhenDisabled_ShouldReturnEmpty()
        {
            var result = await CreateService(new AttachmentMigrationOptions { Enabled = false })
                .MigrateAsync();

            result.Total.Should().Be(0);
            this.unitOfWork.Verify(u => u.AttachmentRepository, Times.Never);
        }

        private string SeedFile(string key)
        {
            var full = Path.Combine(this.sourceRoot, key.Replace('/', Path.DirectorySeparatorChar));
            var directory = Path.GetDirectoryName(full);
            if (!string.IsNullOrEmpty(directory))
                Directory.CreateDirectory(directory);
            File.WriteAllBytes(full, new byte[] { 1, 2, 3, 4 });
            return full;
        }
    }
}
