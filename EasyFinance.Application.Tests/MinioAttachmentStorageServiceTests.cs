using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using EasyFinance.Application.Features.AttachmentService;
using FluentAssertions;
using Moq;

namespace EasyFinance.Application.Tests
{
    public class MinioAttachmentStorageServiceTests
    {
        private readonly Mock<IMinioS3Client> minioClient = new();
        private readonly MinioAttachmentStorageService service;

        public MinioAttachmentStorageServiceTests()
        {
            this.service = new MinioAttachmentStorageService(this.minioClient.Object, "test-bucket");
        }

        [Fact]
        public void Constructor_ShouldEnsureBucketExists()
        {
            this.minioClient.Verify(client => client.EnsureBucketExistsAsync("test-bucket"), Times.Once);
        }

        [Fact]
        public async Task SaveAsync_ShouldUploadWithGeneratedKeyAndReturnKey()
        {
            var content = new MemoryStream(new byte[] { 1, 2, 3, 4 });

            var storageKey = await this.service.SaveAsync(content, "receipt.pdf");

            storageKey.Should().NotBeNullOrEmpty();
            storageKey.Should().EndWith(".pdf");

            var parts = storageKey.Split('/');
            parts.Length.Should().Be(4); // yyyy / MM / dd / guid.pdf

            this.minioClient.Verify(client => client.PutObjectAsync(
                "test-bucket",
                It.Is<string>(key => key == storageKey),
                content,
                (long)content.Length,
                "application/pdf"), Times.Once);
        }

        [Fact]
        public async Task SaveAsync_ShouldKeepOriginalContentTypeMetadata()
        {
            var content = new MemoryStream(new byte[] { 10, 20 });
            var storageKey = await this.service.SaveAsync(content, "photo.jpg");

            this.minioClient.Verify(client => client.PutObjectAsync(
                "test-bucket",
                It.Is<string>(key => key == storageKey),
                content,
                2L,
                "image/jpeg"), Times.Once);
        }

        [Fact]
        public async Task OpenReadAsync_ShouldReturnObjectStream()
        {
            var expected = new MemoryStream(new byte[] { 9, 8, 7 });
            this.minioClient
                .Setup(client => client.GetObjectAsync("test-bucket", "2025/01/15/abc.pdf"))
                .ReturnsAsync(expected);

            var stream = await this.service.OpenReadAsync("2025/01/15/abc.pdf");

            stream.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task OpenReadAsync_WhenObjectMissing_ShouldThrowFileNotFound()
        {
            this.minioClient
                .Setup(client => client.GetObjectAsync("test-bucket", "missing.pdf"))
                .ThrowsAsync(new MinioObjectNotFoundException("missing.pdf"));

            Func<Task> act = async () => await this.service.OpenReadAsync("missing.pdf");

            await act.Should().ThrowAsync<FileNotFoundException>();
        }

        [Fact]
        public async Task DeleteAsync_ShouldRemoveObject()
        {
            await this.service.DeleteAsync("2025/01/15/abc.pdf");

            this.minioClient.Verify(client => client.RemoveObjectAsync("test-bucket", "2025/01/15/abc.pdf"), Times.Once);
        }
    }
}
