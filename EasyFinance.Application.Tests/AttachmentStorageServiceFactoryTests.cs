using System;
using System.Threading.Tasks;
using EasyFinance.Application.Features.AttachmentService;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Tests
{
    public class AttachmentStorageServiceFactoryTests
    {
        private static AttachmentStorageOptions StorageOptions(string provider) =>
            new() { Provider = provider };

        [Fact]
        public void Create_WhenProviderIsFileSystem_ShouldReturnFileSystemStorage()
        {
            var options = Options.Create(StorageOptions("FileSystem"));

            var storage = AttachmentStorageServiceFactory.Create(options, () => null);

            storage.Should().BeOfType<FileSystemAttachmentStorageService>();
        }

        [Fact]
        public void Create_WhenProviderIsMinio_ShouldReturnMinioStorage()
        {
            var options = Options.Create(new AttachmentStorageOptions
            {
                Provider = "Minio",
                Bucket = "test-bucket",
            });

            var storage = AttachmentStorageServiceFactory.Create(options, () => new FakeMinioS3Client());

            storage.Should().BeOfType<MinioAttachmentStorageService>();
        }

        [Fact]
        public void Create_WhenProviderIsUnknown_ShouldThrow()
        {
            var options = Options.Create(StorageOptions("UnknownProvider"));

            Action act = () => AttachmentStorageServiceFactory.Create(options, () => null);

            act.Should().Throw<InvalidOperationException>();
        }

        private class FakeMinioS3Client : IMinioS3Client
        {
            public Task EnsureBucketExistsAsync(string bucket) => Task.CompletedTask;
            public Task PutObjectAsync(string bucket, string key, System.IO.Stream stream, long size, string contentType) => Task.CompletedTask;
            public Task<System.IO.Stream> GetObjectAsync(string bucket, string key) => Task.FromResult<System.IO.Stream>(System.IO.Stream.Null);
            public Task RemoveObjectAsync(string bucket, string key) => Task.CompletedTask;
        }
    }
}
