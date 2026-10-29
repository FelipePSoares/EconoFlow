using System;
using System.Threading.Tasks;
using EasyFinance.Application.Features.AttachmentService;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Tests
{
    /// <summary>
    /// Object storage is the only attachment backend: the file system provider and the
    /// local-to-object-storage migration were removed once every deployment stored its
    /// attachments in MinIO/S3. What is left to guard is that the factory cannot quietly fall
    /// back to anything, and that a partial S3 configuration fails at creation instead of
    /// serving uploads into nowhere.
    /// </summary>
    public class AttachmentStorageServiceFactoryTests
    {
        [Fact]
        public void Create_WithS3Configuration_ShouldReturnMinioStorage()
        {
            var options = Options.Create(new AttachmentStorageOptions
            {
                Endpoint = "minio.internal",
                Bucket = "econoflow",
            });

            var storage = AttachmentStorageServiceFactory.Create(options, () => new FakeMinioS3Client());

            storage.Should().BeOfType<MinioAttachmentStorageService>();
        }

        [Fact]
        public void Create_WhenBucketIsMissing_ShouldThrow()
        {
            // A bucket is what every object write names. Creating the storage without one would
            // defer a configuration error to the first upload instead of start-up.
            var options = Options.Create(new AttachmentStorageOptions
            {
                Endpoint = "minio.internal",
            });

            Action act = () => AttachmentStorageServiceFactory.Create(options, () => new FakeMinioS3Client());

            act.Should().Throw<InvalidOperationException>()
                .WithMessage("*bucket*");
        }

        [Fact]
        public void Create_WhenEndpointIsMissing_ShouldThrow()
        {
            var options = Options.Create(new AttachmentStorageOptions
            {
                Bucket = "econoflow",
            });

            Action act = () => AttachmentStorageServiceFactory.Create(options, () => new FakeMinioS3Client());

            act.Should().Throw<InvalidOperationException>()
                .WithMessage("*endpoint*");
        }

        [Fact]
        public void Create_WhenNoS3ConfigurationAtAll_ShouldThrowRatherThanFallBackToDisk()
        {
            var options = Options.Create(new AttachmentStorageOptions());

            Action act = () => AttachmentStorageServiceFactory.Create(options, () => new FakeMinioS3Client());

            act.Should().Throw<InvalidOperationException>()
                .WithMessage("*S3*");
        }

        [Fact]
        public void Create_WhenTheClientFactoryIsMissing_ShouldThrow()
        {
            var options = Options.Create(new AttachmentStorageOptions
            {
                Endpoint = "minio.internal",
                Bucket = "econoflow",
            });

            Action act = () => AttachmentStorageServiceFactory.Create(options, () => null);

            act.Should().Throw<InvalidOperationException>()
                .WithMessage("*client*");
        }

        [Fact]
        public void IsS3Configured_WithEndpointAndBucket_ShouldReturnTrue()
        {
            var settings = new AttachmentStorageOptions
            {
                Endpoint = "minio.internal",
                Bucket = "econoflow",
            };

            AttachmentStorageServiceFactory.IsS3Configured(settings).Should().BeTrue();
        }

        [Theory]
        [InlineData(true, false)] // Endpoint present, Bucket missing
        [InlineData(false, true)] // Bucket present, Endpoint missing
        [InlineData(false, false)] // Nothing configured
        public void IsS3Configured_WhenTheConfigurationIsIncomplete_ShouldReturnFalse(bool endpointSet, bool bucketSet)
        {
            var settings = new AttachmentStorageOptions
            {
                Endpoint = endpointSet ? "minio.internal" : string.Empty,
                Bucket = bucketSet ? "econoflow" : string.Empty,
            };

            AttachmentStorageServiceFactory.IsS3Configured(settings).Should().BeFalse();
        }

        [Fact]
        public void IsS3Configured_NullSettings_ShouldReturnFalse()
        {
            AttachmentStorageServiceFactory.IsS3Configured(null).Should().BeFalse();
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
