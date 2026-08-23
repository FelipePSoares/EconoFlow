using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.Features.AttachmentService;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;
using Moq;

namespace EasyFinance.Application.Tests
{
    public class MinioS3ClientAdapterTests
    {
        private readonly Mock<IMinioClient> minioClient = new();
        private readonly MinioS3ClientAdapter adapter;

        public MinioS3ClientAdapterTests()
        {
            this.adapter = new MinioS3ClientAdapter(this.minioClient.Object);
        }

        [Fact]
        public async Task GetObjectAsync_WhenTransientAccessDenied_ShouldRetryAndSucceed()
        {
            this.minioClient
                .SetupSequence(client => client.GetObjectAsync(It.IsAny<GetObjectArgs>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new AccessDeniedException("transient denied"))
                .ThrowsAsync(new AccessDeniedException("transient denied"))
                .ReturnsAsync((Minio.DataModel.ObjectStat)null!);

            var stream = await this.adapter.GetObjectAsync("bucket", "2026/08/14/file.pdf");

            stream.Should().NotBeNull();
            this.minioClient.Verify(
                client => client.GetObjectAsync(It.IsAny<GetObjectArgs>(), It.IsAny<CancellationToken>()),
                Times.Exactly(3));
        }

        [Fact]
        public async Task GetObjectAsync_WhenRetrying_ShouldLogWarning()
        {
            var logger = new Mock<ILogger<MinioS3ClientAdapter>>();
            var adapterWithLogging = new MinioS3ClientAdapter(this.minioClient.Object, logger.Object);

            this.minioClient
                .SetupSequence(client => client.GetObjectAsync(It.IsAny<GetObjectArgs>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new AccessDeniedException("transient denied"))
                .ReturnsAsync((Minio.DataModel.ObjectStat)null!);

            var stream = await adapterWithLogging.GetObjectAsync("bucket", "2026/08/14/file.pdf");

            stream.Should().NotBeNull();
            logger.Verify(
                x => x.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => true),
                    It.IsAny<Exception>(),
                    It.Is<Func<It.IsAnyType, Exception, string>>((v, t) => true)!),
                Times.Once);
        }

        [Fact]
        public async Task GetObjectAsync_WhenPersistentAccessDenied_ShouldThrow()
        {
            this.minioClient
                .Setup(client => client.GetObjectAsync(It.IsAny<GetObjectArgs>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new AccessDeniedException("still denied"));

            Func<Task> act = async () => await this.adapter.GetObjectAsync("bucket", "file.pdf");

            await act.Should().ThrowAsync<AccessDeniedException>();
            this.minioClient.Verify(
                client => client.GetObjectAsync(It.IsAny<GetObjectArgs>(), It.IsAny<CancellationToken>()),
                Times.Exactly(3));
        }

        [Fact]
        public async Task GetObjectAsync_WhenObjectMissing_ShouldWrapInMinioObjectNotFoundException()
        {
            this.minioClient
                .Setup(client => client.GetObjectAsync(It.IsAny<GetObjectArgs>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new ObjectNotFoundException());

            Func<Task> act = async () => await this.adapter.GetObjectAsync("bucket", "missing.pdf");

            await act.Should().ThrowAsync<MinioObjectNotFoundException>()
                .WithMessage("missing.pdf");
        }
    }
}
