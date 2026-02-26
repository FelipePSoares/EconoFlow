using System;
using System.IO;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.AttachmentService
{
    public class FileSystemAttachmentStorageService : IAttachmentStorageService
    {
        private const string RootPathEnvironmentVariable = "EconoFlow_ATTACHMENTS_ROOT_PATH";
        private readonly string rootPath;

        public FileSystemAttachmentStorageService()
        {
            this.rootPath = Environment.GetEnvironmentVariable(RootPathEnvironmentVariable);
            if (string.IsNullOrWhiteSpace(this.rootPath))
                this.rootPath = Path.Combine(AppContext.BaseDirectory, "attachments");

            Directory.CreateDirectory(this.rootPath);
        }

        public async Task<string> SaveAsync(Stream content, string fileName)
        {
            ArgumentNullException.ThrowIfNull(content);

            var extension = Path.GetExtension(fileName);
            var storageKey = $"{DateTime.UtcNow:yyyy/MM/dd}/{Guid.NewGuid():N}{extension}";
            var fullPath = ResolveStoragePath(storageKey);

            var directoryPath = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrWhiteSpace(directoryPath))
                Directory.CreateDirectory(directoryPath);

            using var fileStream = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
            await content.CopyToAsync(fileStream);
            await fileStream.FlushAsync();

            return storageKey;
        }

        public Task<Stream> OpenReadAsync(string storageKey)
        {
            var fullPath = ResolveStoragePath(storageKey);
            if (!File.Exists(fullPath))
                throw new FileNotFoundException("Attachment file not found in storage.", storageKey);

            Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
            return Task.FromResult(stream);
        }

        public Task DeleteAsync(string storageKey)
        {
            var fullPath = ResolveStoragePath(storageKey);
            if (File.Exists(fullPath))
                File.Delete(fullPath);

            return Task.CompletedTask;
        }

        private string ResolveStoragePath(string storageKey)
        {
            if (string.IsNullOrWhiteSpace(storageKey))
                throw new ArgumentException("Storage key is required.", nameof(storageKey));

            var normalizedStorageKey = storageKey.Replace('\\', '/').TrimStart('/');
            var combinedPath = Path.Combine(this.rootPath, normalizedStorageKey.Replace('/', Path.DirectorySeparatorChar));

            var fullRootPath = Path.GetFullPath(this.rootPath);
            var fullCombinedPath = Path.GetFullPath(combinedPath);
            if (!fullCombinedPath.StartsWith(fullRootPath, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Storage key resolved to an invalid path.");

            return fullCombinedPath;
        }
    }
}
