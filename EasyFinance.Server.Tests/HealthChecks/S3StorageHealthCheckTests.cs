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
    /// <summary>
    /// Object storage is the only attachment backend now, so the readiness probe has exactly
    /// two things to say: the bucket is reachable (Healthy), or it is not (Unhealthy). There is
    /// no file-system provider whose absence of a dependency could be reported as Healthy;
    /// an incomplete S3 configuration is a misconfiguration, not a working default.
    /// </summary>
    public class S3StorageHealthCheckTests
    {
        private static HealthCheckContext CreateContext() => new();

        private static IOptions<AttachmentStorageOptions> CreateOptions(
            string bucket = "test-bucket",
            string endpoint = "localhost:9000")
            => Options.Create(new AttachmentStorageOptions
            {
                Bucket = bucket,
                Endpoint = endpoint,
            });

        private static IServiceProvider CreateServiceProvider(Mock<IMinioS3Client> minioClientMock) =>
            new ServiceCollection()
                .AddSingleton(minioClientMock.Object)
                .BuildServiceProvider();

        [Fact]
        public async Task CheckHealth_WhenTheBucketIsReachable_ShouldBeHealthy()
        {
            // Arrange
            var minioClientMock = new Mock<IMinioS3Client>();
            minioClientMock
                .Setup(x => x.EnsureBucketExistsAsync("test-bucket"))
                .Returns(Task.CompletedTask);
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions());

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Healthy);
            minioClientMock.Verify(x => x.EnsureBucketExistsAsync("test-bucket"), Times.Once);
        }

        [Fact]
        public async Task CheckHealth_WhenTheBucketIsUnreachable_ShouldBeUnhealthy()
        {
            // Arrange
            var minioClientMock = new Mock<IMinioS3Client>();
            minioClientMock
                .Setup(x => x.EnsureBucketExistsAsync(It.IsAny<string>()))
                .ThrowsAsync(new InvalidOperationException("S3 endpoint unreachable"));
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions());

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Unhealthy);
            result.Exception.ShouldNotBeNull();
        }

        [Fact]
        public async Task CheckHealth_WithoutABucket_ShouldBeUnhealthy()
        {
            // Arrange
            var minioClientMock = new Mock<IMinioS3Client>();
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions(bucket: string.Empty));

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Unhealthy);
            minioClientMock.Verify(x => x.EnsureBucketExistsAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task CheckHealth_WithoutAnEndpoint_ShouldBeUnhealthy()
        {
            // Arrange
            var minioClientMock = new Mock<IMinioS3Client>();
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions(endpoint: string.Empty));

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Unhealthy);
            minioClientMock.Verify(x => x.EnsureBucketExistsAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task CheckHealth_WithNothingConfigured_ShouldBeUnhealthy()
        {
            // The readiness probe must not report Healthy for an application that cannot store
            // an attachment at all: that is exactly the state the file-system fallback used to
            // hide.
            var minioClientMock = new Mock<IMinioS3Client>();
            var check = new S3StorageHealthCheck(
                CreateServiceProvider(minioClientMock),
                CreateOptions(bucket: string.Empty, endpoint: string.Empty));

            // Act
            var result = await check.CheckHealthAsync(CreateContext(), CancellationToken.None);

            // Assert
            result.Status.ShouldBe(HealthStatus.Unhealthy);
            minioClientMock.Verify(x => x.EnsureBucketExistsAsync(It.IsAny<string>()), Times.Never);
        }
    }
}
