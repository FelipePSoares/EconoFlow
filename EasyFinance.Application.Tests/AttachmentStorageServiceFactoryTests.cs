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
        public void Create_WhenProviderIsDefaultButS3EndpointSet_ShouldReturnMinioStorage()
        {
            var options = Options.Create(new AttachmentStorageOptions
            {
                Provider = AttachmentStorageOptions.DefaultProvider, // "FileSystem"
                Endpoint = "minio.shared-services.svc.cluster.local",
                Bucket = "econoflow",
            });

            var storage = AttachmentStorageServiceFactory.Create(options, () => new FakeMinioS3Client());

            storage.Should().BeOfType<MinioAttachmentStorageService>();
        }

        [Fact]
        public void Create_WhenProviderIsDefaultAndNoS3Endpoint_ShouldReturnFileSystemStorage()
        {
            var options = Options.Create(StorageOptions(AttachmentStorageOptions.DefaultProvider));

            var storage = AttachmentStorageServiceFactory.Create(options, () => null);

            storage.Should().BeOfType<FileSystemAttachmentStorageService>();
        }

        [Fact]
        public void IsMinioConfigured_ExplicitMinio_ShouldReturnTrue()
        {
            var settings = new AttachmentStorageOptions { Provider = "Minio", Bucket = "b" };

            AttachmentStorageServiceFactory.IsMinioConfigured(settings).Should().BeTrue();
        }

        [Fact]
        public void IsMinioConfigured_ExplicitMinioWithoutBucket_ShouldReturnTrue()
        {
            // Provider is explicit; the factory throws a dedicated bucket-required
            // error at creation time rather than treating the config as FileSystem.
            var settings = new AttachmentStorageOptions { Provider = "Minio" };

            AttachmentStorageServiceFactory.IsMinioConfigured(settings).Should().BeTrue();
        }

        [Fact]
        public void IsMinioConfigured_DefaultProviderWithS3EndpointAndBucket_ShouldReturnTrue()
        {
            var settings = new AttachmentStorageOptions
            {
                Provider = AttachmentStorageOptions.DefaultProvider,
                Endpoint = "minio.internal",
                Bucket = "econoflow",
            };

            AttachmentStorageServiceFactory.IsMinioConfigured(settings).Should().BeTrue();
        }

        [Theory]
        [InlineData("FileSystem")]
        [InlineData("filesystem")]
        [InlineData("")]
        public void IsMinioConfigured_NoS3Config_ShouldReturnFalse(string provider)
        {
            var settings = new AttachmentStorageOptions { Provider = provider };

            AttachmentStorageServiceFactory.IsMinioConfigured(settings).Should().BeFalse();
        }

        [Theory]
        [InlineData(false, true)] // Endpoint present, Bucket missing
        [InlineData(true, false)]  // Bucket present, Endpoint missing
        public void IsMinioConfigured_PartialS3Config_ShouldReturnFalse(bool endpointSet, bool bucketSet)
        {
            var settings = new AttachmentStorageOptions
            {
                Provider = AttachmentStorageOptions.DefaultProvider,
                Endpoint = endpointSet ? "minio.internal" : string.Empty,
                Bucket = bucketSet ? "econoflow" : string.Empty,
            };

            AttachmentStorageServiceFactory.IsMinioConfigured(settings).Should().BeFalse();
        }

        [Fact]
        public void IsMinioConfigured_NullSettings_ShouldReturnFalse()
        {
            AttachmentStorageServiceFactory.IsMinioConfigured(null).Should().BeFalse();
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
