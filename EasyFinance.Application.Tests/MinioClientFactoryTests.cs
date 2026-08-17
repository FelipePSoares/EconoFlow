using EasyFinance.Application.Features.AttachmentService;
using FluentAssertions;

namespace EasyFinance.Application.Tests
{
    public class MinioClientFactoryTests
    {
        [Fact]
        public void NormalizeEndpoint_WithScheme_ShouldStripScheme()
        {
            MinioClientFactory.NormalizeEndpoint("https://minio-api.fpssoftware.uk")
                .Should().Be("minio-api.fpssoftware.uk");
        }

        [Fact]
        public void NormalizeEndpoint_WithPortAndScheme_ShouldKeepHostOnly()
        {
            MinioClientFactory.NormalizeEndpoint("http://localhost:9000")
                .Should().Be("localhost");
        }

        [Fact]
        public void NormalizeEndpoint_WithoutScheme_ShouldReturnUnchanged()
        {
            MinioClientFactory.NormalizeEndpoint("minio-api.fpssoftware.uk")
                .Should().Be("minio-api.fpssoftware.uk");
        }
    }
}
