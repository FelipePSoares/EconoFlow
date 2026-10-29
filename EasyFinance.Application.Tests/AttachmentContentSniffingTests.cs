using System;
using System.IO;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Common.Tests.Files;
using FluentAssertions;

namespace EasyFinance.Application.Tests
{
    public class AttachmentContentSniffingTests
    {
        [Fact]
        public void SniffContentType_WithPdf_ShouldReturnPdf()
        {
            AttachmentUploadPolicy.SniffContentType(new MemoryStream(AttachmentTestFiles.Pdf))
                .Should().Be("application/pdf");
        }

        [Theory]
        [InlineData("image/png")]
        [InlineData("image/jpeg")]
        [InlineData("image/webp")]
        [InlineData("image/heic")]
        [InlineData("image/heif")]
        public void SniffContentType_WithEachAllowedImage_ShouldReturnItsType(string expectedContentType)
        {
            var payload = PayloadFor(expectedContentType);

            using var stream = new MemoryStream(payload);

            AttachmentUploadPolicy.SniffContentType(stream).Should().Be(expectedContentType);
        }

        [Fact]
        public void SniffContentType_WithHeicWhoseMajorBrandIsAModeBrand_ShouldReturnHeic()
        {
            using var stream = new MemoryStream(AttachmentTestFiles.HeicWithMif1Brand);

            AttachmentUploadPolicy.SniffContentType(stream).Should().Be("image/heic");
        }

        [Fact]
        public void SniffContentType_WithMp4Container_ShouldReturnNull()
        {
            using var stream = new MemoryStream(AttachmentTestFiles.Mp4);

            AttachmentUploadPolicy.SniffContentType(stream).Should().BeNull();
        }

        [Theory]
        [MemberData(nameof(DisguisedContent))]
        public void SniffContentType_WithDisguisedOrUnknownContent_ShouldReturnNull(string description, byte[] payload)
        {
            _ = description;
            using var stream = new MemoryStream(payload);

            AttachmentUploadPolicy.SniffContentType(stream).Should().BeNull();
        }

        [Fact]
        public void SniffContentType_WithTruncatedFile_ShouldReturnNull()
        {
            // The head of a real PDF, cut before the signature completes. A truncated upload
            // is indistinguishable from a file that merely starts with those bytes.
            using var stream = new MemoryStream(AttachmentTestFiles.TruncatedPdf);

            AttachmentUploadPolicy.SniffContentType(stream).Should().BeNull();
        }

        [Fact]
        public void SniffContentType_WithEmptyStream_ShouldReturnNull()
        {
            using var stream = new MemoryStream(Array.Empty<byte>());

            AttachmentUploadPolicy.SniffContentType(stream).Should().BeNull();
        }

        [Fact]
        public void SniffContentType_ShouldNotMoveASeekableStream()
        {
            // Validation runs before the file is stored, so the signature read must not
            // consume the bytes the storage service is about to copy.
            using var stream = new MemoryStream(AttachmentTestFiles.Pdf);

            AttachmentUploadPolicy.SniffContentType(stream);

            stream.Position.Should().Be(0);
        }

        [Theory]
        [InlineData("image/jpg", "image/jpeg")]
        [InlineData("IMAGE/JPG", "image/jpeg")]
        [InlineData(" application/pdf ", "application/pdf")]
        [InlineData("Image/Heic", "image/heic")]
        public void NormalizeContentTypeForStorage_ShouldReturnTheCanonicalType(string declaredContentType, string expected)
        {
            AttachmentUploadPolicy.NormalizeContentTypeForStorage(declaredContentType).Should().Be(expected);
        }

        public static TheoryData<string, byte[]> DisguisedContent => new()
        {
            { "windows executable", AttachmentTestFiles.WindowsExecutable },
            { "elf executable", AttachmentTestFiles.ElfExecutable },
            { "svg document", AttachmentTestFiles.Svg },
            { "plain text", AttachmentTestFiles.PlainText },
        };

        private static byte[] PayloadFor(string contentType) => contentType switch
        {
            "image/png" => AttachmentTestFiles.Png,
            "image/jpeg" => AttachmentTestFiles.Jpeg,
            "image/webp" => AttachmentTestFiles.Webp,
            "image/heic" => AttachmentTestFiles.Heic,
            "image/heif" => AttachmentTestFiles.Heif,
            _ => throw new ArgumentOutOfRangeException(nameof(contentType), contentType, "No payload registered.")
        };
    }
}
