using System;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Server.HealthChecks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Moq;
using Shouldly;

namespace EasyFinance.Server.Tests.HealthChecks
{
    public class S3StorageHealthCheckTests
    {
        private static HealthCheckContext CreateContext() => new();

        private static IOptions<AttachmentStorageOptions> CreateOptions(
            string provider,
            string bucket = "test-bucket",
            string endpoint = "localhost:9000")
            => Options.Create(new AttachmentStorageOptions
            {
                Provider = provider,
                Bucket = bucket,
                Endpoint = endpoint,
            });

        private static IServiceProvider CreateServiceProvider(Mock<IMinioS3Client> minioClientMock) =>
            new ServiceCollection()
                .AddSingleton(minioClientMock.Object)
                .BuildServiceProvider();

        [Fact]
        public async Task CheckHealth_CleanFileSystemProvider_ShouldBeHealthy()
        {
            // Arrange
            var minioClientMock = new Mock<IMinioS3Client>();
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions("FileSystem"));

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Healthy);
            minioClientMock.Verify(x => x.EnsureBucketExistsAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task CheckHealth_EmptyProvider_ShouldBeHealthy()
        {
            // Arrange
            var minioClientMock = new Mock<IMinioS3Client>();
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions(string.Empty));

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Healthy);
            minioClientMock.Verify(x => x.EnsureBucketExistsAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task CheckHealth_MinioProviderWithAvailableS3_ShouldBeHealthy()
        {
            // Arrange
            var minioClientMock = new Mock<IMinioS3Client>();
            minioClientMock
                .Setup(x => x.EnsureBucketExistsAsync("test-bucket"))
                .Returns(Task.CompletedTask);
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions("Minio"));

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Healthy);
            minioClientMock.Verify(x => x.EnsureBucketExistsAsync("test-bucket"), Times.Once);
        }

        [Fact]
        public async Task CheckHealth_MinioProviderWithS3Unavailable_ShouldBeUnhealthy()
        {
            // Arrange
            var minioClientMock = new Mock<IMinioS3Client>();
            minioClientMock
                .Setup(x => x.EnsureBucketExistsAsync(It.IsAny<string>()))
                .ThrowsAsync(new InvalidOperationException("S3 endpoint unreachable"));
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions("Minio"));

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Unhealthy);
            result.Exception.ShouldNotBeNull();
        }

        [Fact]
        public async Task CheckHealth_MinioProviderWithoutBucket_ShouldBeUnhealthy()
        {
            // Arrange
            var minioClientMock = new Mock<IMinioS3Client>();
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions("Minio", bucket: string.Empty));

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Unhealthy);
            minioClientMock.Verify(x => x.EnsureBucketExistsAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task CheckHealth_UnknownProvider_ShouldBeUnhealthy()
        {
            // Arrange
            var minioClientMock = new Mock<IMinioS3Client>();
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions("CustomProvider"));

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Unhealthy);
            minioClientMock.Verify(x => x.EnsureBucketExistsAsync(It.IsAny<string>()), Times.Never);
        }
    }
}
