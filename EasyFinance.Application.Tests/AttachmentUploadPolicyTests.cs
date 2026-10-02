using System.Linq;
using EasyFinance.Application.Features.AttachmentService;
using FluentAssertions;

namespace EasyFinance.Application.Tests
{
    public class AttachmentUploadPolicyTests
    {
        [Fact]
        public void MaxAttachmentSizeBytes_ShouldBeTenMegabytes()
        {
            AttachmentUploadPolicy.MaxAttachmentSizeBytes.Should().Be(10 * 1024 * 1024);
        }

        [Theory]
        [InlineData("application/pdf")]
        [InlineData("image/jpeg")]
        [InlineData("image/jpg")]
        [InlineData("image/png")]
        [InlineData("image/webp")]
        [InlineData("image/heic")]
        [InlineData("image/heif")]
        public void IsAllowedContentType_WithAllowedType_ShouldBeTrue(string contentType)
        {
            AttachmentUploadPolicy.IsAllowedContentType(contentType).Should().BeTrue();
        }

        [Theory]
        [InlineData("IMAGE/PNG")]
        [InlineData("Application/Pdf")]
        [InlineData(" application/pdf ")]
        public void IsAllowedContentType_ShouldIgnoreCaseAndSurroundingWhitespace(string contentType)
        {
            AttachmentUploadPolicy.IsAllowedContentType(contentType).Should().BeTrue();
        }

        [Theory]
        [InlineData("text/plain")]
        [InlineData("application/octet-stream")]
        [InlineData("application/x-msdownload")]
        [InlineData("")]
        [InlineData(" ")]
        public void IsAllowedContentType_WithDisallowedOrEmptyType_ShouldBeFalse(string contentType)
        {
            AttachmentUploadPolicy.IsAllowedContentType(contentType).Should().BeFalse();
        }

        [Fact]
        public void AllowedContentTypesDescription_ShouldListEveryAllowedType()
        {
            var description = AttachmentUploadPolicy.AllowedContentTypesDescription;

            description.Should().Contain("application/pdf");
            description.Split(',').Select(entry => entry.Trim()).Should().HaveCount(7);
        }
    }
}
