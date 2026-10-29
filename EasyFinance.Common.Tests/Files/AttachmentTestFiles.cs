using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EasyFinance.Common.Tests.Files
{
    /// <summary>
    /// Byte payloads and streams for attachment upload tests.
    ///
    /// <para>
    /// The upload path verifies real file signatures, so a test that uploads
    /// <c>new byte[] { 1, 2, 3, 4 }</c> and calls it a PDF now fails for a reason that has
    /// nothing to do with what it is asserting. Every upload test takes its content from
    /// here instead: the valid files pass the signature check, and the hostile ones exist to
    /// prove they are refused.
    /// </para>
    ///
    /// <para>
    /// The sizes are deliberately tiny - the signatures are real, the bodies are not. Nothing
    /// in the application inspects anything past the first bytes except the HEIC/HEIF
    /// container brands.
    /// </para>
    /// </summary>
    public static class AttachmentTestFiles
    {
        /// <summary>A minimal but complete PDF: <c>%PDF-1.4</c>, one object, <c>%%EOF</c>.</summary>
        public static byte[] Pdf { get; } = Encoding.ASCII.GetBytes(
            "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");

        /// <summary>A 1x1 PNG: the full eight-byte signature followed by the IHDR chunk header.</summary>
        public static byte[] Png { get; } =
        {
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89
        };

        /// <summary>A JPEG: SOI plus an APP0/JFIF marker.</summary>
        public static byte[] Jpeg { get; } =
        {
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
            0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
        };

        /// <summary>A WebP: a RIFF container whose form type is <c>WEBP</c>.</summary>
        public static byte[] Webp { get; } = BuildRiff("WEBP", "VP8 ");

        /// <summary>A HEIC file - an ISO-BMFF container with the <c>heic</c> major brand.</summary>
        public static byte[] Heic { get; } = BuildIsoBmff("heic");

        /// <summary>A HEIF file - an ISO-BMFF container with the <c>heif</c> major brand.</summary>
        public static byte[] Heif { get; } = BuildIsoBmff("heif");

        /// <summary>A HEIC file whose major brand is a mode brand and whose compatible brand is <c>heic</c>.</summary>
        public static byte[] HeicWithMif1Brand { get; } = BuildIsoBmff("mif1", "mif1", "heic");

        /// <summary>An MP4: the same <c>ftyp</c> container, a brand that is not an image.</summary>
        public static byte[] Mp4 { get; } = BuildIsoBmff("isom", "isom", "mp41");

        /// <summary>A Windows executable: <c>MZ</c> at the start and a <c>PE\0\0</c> stub.</summary>
        public static byte[] WindowsExecutable { get; } =
        {
            0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00,
            0xB8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x50, 0x45, 0x00, 0x00, 0x4C, 0x01, 0x01, 0x00
        };

        /// <summary>An ELF executable: <c>7F 45 4C 46</c> followed by the 64-bit header fields.</summary>
        public static byte[] ElfExecutable { get; } =
        {
            0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        };

        /// <summary>An SVG document - XML text that a browser would render as an active image.</summary>
        public static byte[] Svg { get; } = Encoding.UTF8.GetBytes(
            "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>");

        /// <summary>Plain text - a file whose declared type could claim anything.</summary>
        public static byte[] PlainText { get; } = Encoding.UTF8.GetBytes("plain text notes");

        /// <summary>A PDF whose first bytes were cut off, so the signature cannot be verified.</summary>
        public static byte[] TruncatedPdf { get; } = Encoding.ASCII.GetBytes("%PD");

        /// <summary>Content that starts like a PDF but never reaches the dashboard object.</summary>
        public static byte[] PdfHeaderWithoutBody { get; } = Encoding.ASCII.GetBytes("%PDF-1.7\n");

        /// <summary>
        /// A stream that cannot seek - the shape of a chunked request body. The upload path
        /// must buffer it rather than require <see cref="Stream.CanSeek"/>.
        /// </summary>
        public static Stream NonSeekable(byte[] payload) => new ForwardOnlyStream(payload);

        private static byte[] BuildRiff(string formType, string chunkId)
        {
            using var buffer = new MemoryStream();
            buffer.Write(Encoding.ASCII.GetBytes("RIFF"));
            buffer.Write(BitConverter.GetBytes(4 + chunkId.Length));
            buffer.Write(Encoding.ASCII.GetBytes(formType));
            buffer.Write(Encoding.ASCII.GetBytes(chunkId));
            buffer.Write(new byte[8]);
            return buffer.ToArray();
        }

        private static byte[] BuildIsoBmff(string majorBrand, params string[] compatibleBrands)
        {
            // ftyp: 4-byte box size, 'ftyp', 4-byte major brand, 4-byte minor version,
            // then one 4-byte entry per compatible brand.
            var boxSize = 16 + (compatibleBrands.Length * 4);

            using var buffer = new MemoryStream();
            buffer.Write(BitConverter.GetBytes(boxSize));
            buffer.Write(Encoding.ASCII.GetBytes("ftyp"));
            buffer.Write(Encoding.ASCII.GetBytes(majorBrand));
            buffer.Write(new byte[4]);

            foreach (var brand in compatibleBrands)
                buffer.Write(Encoding.ASCII.GetBytes(brand));

            return buffer.ToArray();
        }

        /// <summary>
        /// A stream that, like a request body, can only move forward. Copying from it goes
        /// through the same synchronous <see cref="Read"/> the signature check uses, so a test
        /// that reads the head and then copies the stream exercises a real consumption
        /// problem rather than a fixture quirk.
        /// </summary>
        private sealed class ForwardOnlyStream : Stream
        {
            private readonly MemoryStream inner;

            public ForwardOnlyStream(byte[] payload) => this.inner = new MemoryStream(payload, writable: false);

            public override bool CanRead => true;
            public override bool CanSeek => false;
            public override bool CanWrite => false;
            public override long Length => throw new NotSupportedException();

            public override long Position
            {
                get => throw new NotSupportedException();
                set => throw new NotSupportedException();
            }

            public override int Read(byte[] buffer, int offset, int count) => this.inner.Read(buffer, offset, count);

            public override int Read(Span<byte> buffer) => this.inner.Read(buffer);

            public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
                => Task.FromResult(this.inner.Read(buffer, offset, count));

            public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
                => new(this.inner.Read(buffer.Span));

            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void Flush() { }
            public override void SetLength(long value) => throw new NotSupportedException();
            public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        }
    }
}
