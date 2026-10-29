using System;
using System.IO;
using System.Linq;
using FluentAssertions;
using Xunit;

namespace EasyFinance.Application.Tests
{
    /// <summary>
    /// Guards that attachments are stored in object storage and nowhere else.
    ///
    /// <para>
    /// The file-system provider and the local-to-object-storage migration were a cutover
    /// scaffold: while both existed, a configuration mistake silently kept uploads on a disk
    /// that nothing backed up, and the migration job logged "disabled" on every start. The
    /// scaffold is gone, and these guards keep it from coming back one file at a time - a
    /// second <see cref="Features.AttachmentService.IAttachmentStorageService"/> implementation
    /// or a resurrected migration service would be a silent second backend, not a compile
    /// error.
    /// </para>
    /// </summary>
    public class AttachmentStorageSingleBackendTests
    {
        private static string RepoRoot()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);

            while (directory != null)
            {
                if (File.Exists(Path.Combine(directory.FullName, "EasyFinance.sln")))
                    return directory.FullName;

                directory = directory.Parent;
            }

            throw new InvalidOperationException(
                $"Could not locate the repository root above '{AppContext.BaseDirectory}'.");
        }

        private static string[] StorageFeatureFiles() =>
            Directory
                .GetFiles(
                    Path.Combine(RepoRoot(), "EasyFinance.Application", "Features", "AttachmentService"),
                    "*.cs",
                    SearchOption.TopDirectoryOnly)
                .Select(path => Path.GetFileName(path) ?? string.Empty)
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToArray();

        [Fact]
        public void TheAttachmentStorageFeature_ShouldNotCarryAFileSystemProvider()
        {
            StorageFeatureFiles().Should().NotContain(
                "FileSystemAttachmentStorageService.cs",
                "object storage is the only backend; writes to a container's own disk are lost "
                + "on the next deploy and are not backed up");
        }

        [Fact]
        public void TheAttachmentStorageFeature_ShouldNotCarryTheMigrationJob()
        {
            StorageFeatureFiles().Should().NotContain(
                new[]
                {
                    "AttachmentMigrationBackgroundService.cs",
                    "AttachmentMigrationService.cs",
                    "AttachmentMigrationOptions.cs",
                    "AttachmentMigrationResult.cs",
                },
                "the cutover from local disk to object storage is finished, so there is nothing "
                + "left to migrate and no job that should log about it on every start");
        }

        [Fact]
        public void TheAttachmentStorageFeature_ShouldDeclareExactlyOneStorageImplementation()
        {
            // IAttachmentStorageService is what every upload and download goes through. Two
            // implementations are only useful if something selects between them, which is the
            // arrangement this change removed.
            var implementations = StorageFeatureFiles()
                .Where(name => !name.StartsWith("I", StringComparison.Ordinal))
                .Where(name => name.EndsWith("AttachmentStorageService.cs", StringComparison.Ordinal))
                .ToArray();

            implementations.Should().Equal(
                new[] { "MinioAttachmentStorageService.cs" },
                "MinIO/S3 is the only attachment backend");
        }
    }
}
