using System;
using System.Collections.Generic;
using System.IO;

namespace EasyFinance.Application.Features.AttachmentService
{
    public static class AttachmentUploadPolicy
    {
        public const long MaxAttachmentSizeBytes = 10 * 1024 * 1024; // 10 MB

        /// <summary>
        /// How many leading bytes the signature check reads. The longest signature in the
        /// table is the ISO-BMFF <c>ftyp</c> header plus its compatible brands, so this is
        /// comfortably more than any of them need.
        /// </summary>
        public const int SignatureReadSize = 64;

        private static readonly HashSet<string> allowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "application/pdf",
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif"
        };

        private static readonly byte[] PdfSignature = { 0x25, 0x50, 0x44, 0x46, 0x2D }; // %PDF-
        private static readonly byte[] PngSignature = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        private static readonly byte[] JpegSignature = { 0xFF, 0xD8, 0xFF };
        private static readonly byte[] RiffSignature = { 0x52, 0x49, 0x46, 0x46 }; // RIFF
        private static readonly byte[] WebpFormType = { 0x57, 0x45, 0x42, 0x50 }; // WEBP
        private static readonly byte[] IsoBmffBoxSignature = { 0x66, 0x74, 0x79, 0x70 }; // ftyp

        // ISO-BMFF brands that carry HEVC-coded images. 'mif1'/'msf1' are the mode brands a
        // HEIF container may declare instead of identifying the codec.
        private static readonly HashSet<string> HeicBrands = new(StringComparer.Ordinal)
        {
            "heic", "heix", "heim", "heis", "hevc", "hevx"
        };

        private static readonly HashSet<string> HeifBrands = new(StringComparer.Ordinal)
        {
            "heif", "mif1", "msf1"
        };

        public static bool IsAllowedContentType(string contentType)
        {
            if (string.IsNullOrWhiteSpace(contentType))
                return false;

            return allowedContentTypes.Contains(contentType.Trim());
        }

        public static string AllowedContentTypesDescription
            => string.Join(", ", allowedContentTypes);

        /// <summary>
        /// Reads the leading bytes of <paramref name="content"/> and returns the content type
        /// they actually are, or <c>null</c> when the content is empty, too short to carry a
        /// signature, or not one of the allowed types.
        ///
        /// <para>
        /// The declared <c>Content-Type</c> is a client claim, so the type that is stored and
        /// later served back must come from the bytes. Detection is deliberately limited to
        /// the allowed types: anything else - an executable, a script, an SVG - is
        /// unrecognized rather than "some other type".
        /// </para>
        ///
        /// <para>
        /// A seekable stream is left exactly where it was found, because validation runs
        /// before the file is copied to storage.
        /// </para>
        /// </summary>
        public static string SniffContentType(Stream content)
        {
            if (content == null)
                return null;

            var head = ReadHead(content);

            if (head.Length == 0)
                return null;

            return DetectContentType(head);
        }

        /// <summary>
        /// Canonical type for storage: trimmed, lower-cased, and with the legacy
        /// <c>image/jpg</c> alias folded into <c>image/jpeg</c> so that a JPEG is stored under
        /// one type no matter which spelling the client used.
        /// </summary>
        public static string NormalizeContentTypeForStorage(string contentType)
        {
            if (string.IsNullOrWhiteSpace(contentType))
                return string.Empty;

            var normalized = contentType.Trim().ToLowerInvariant();

            return normalized == "image/jpg" ? "image/jpeg" : normalized;
        }

        private static string DetectContentType(byte[] head)
        {
            if (StartsWith(head, PdfSignature))
                return "application/pdf";

            if (StartsWith(head, PngSignature))
                return "image/png";

            if (StartsWith(head, JpegSignature))
                return "image/jpeg";

            // WebP is a RIFF container: 'RIFF' <size> 'WEBP'.
            if (StartsWith(head, RiffSignature) && MatchesAt(head, 8, WebpFormType))
                return "image/webp";

            // HEIC/HEIF is an ISO-BMFF container: <size> 'ftyp' <major brand> <version> ...
            if (MatchesAt(head, 4, IsoBmffBoxSignature))
                return DetectIsoBmffImageBrand(head);

            return null;
        }

        private static string DetectIsoBmffImageBrand(byte[] head)
        {
            // The major brand is the most specific statement of the format; the compatible
            // brands that follow can mention HEVC even when the major brand is a mode brand
            // such as 'mif1'.
            var majorBrand = ReadBrand(head, 8);
            if (majorBrand == null)
                return null;

            if (HeicBrands.Contains(majorBrand))
                return "image/heic";

            if (HeifBrands.Contains(majorBrand))
                return majorBrand == "heif" ? "image/heif" : DetectBrandBehindModeBrand(head);

            return null;
        }

        /// <summary>
        /// A major brand of 'mif1'/'msf1' says "a HEIF container" without saying which codec
        /// it holds, so the compatible brands decide. A container that names none of the HEVC
        /// brands is treated as HEIF, which is what such a file claims to be.
        /// </summary>
        private static string DetectBrandBehindModeBrand(byte[] head)
        {
            // Box layout: size(4) 'ftyp'(4) major(4) minor version(4) then 4-byte brands.
            for (var offset = 16; offset + 4 <= head.Length; offset += 4)
            {
                var brand = ReadBrand(head, offset);

                if (brand != null && HeicBrands.Contains(brand))
                    return "image/heic";
            }

            return "image/heif";
        }

        private static string ReadBrand(byte[] head, int offset)
        {
            if (head.Length < offset + 4)
                return null;

            var brand = new byte[4];
            Array.Copy(head, offset, brand, 0, 4);

            foreach (var value in brand)
            {
                if (value < 0x20 || value > 0x7E)
                    return null;
            }

            return System.Text.Encoding.ASCII.GetString(brand);
        }

        private static byte[] ReadHead(Stream content)
        {
            if (!content.CanRead)
                return Array.Empty<byte>();

            var originalPosition = content.CanSeek ? content.Position : 0;

            var buffer = new byte[SignatureReadSize];
            var total = 0;

            try
            {
                int read;
                while (total < buffer.Length && (read = content.Read(buffer, total, buffer.Length - total)) > 0)
                    total += read;
            }
            finally
            {
                if (content.CanSeek)
                    content.Position = originalPosition;
            }

            if (total == buffer.Length)
                return buffer;

            var head = new byte[total];
            Array.Copy(buffer, head, total);
            return head;
        }

        private static bool StartsWith(byte[] buffer, byte[] signature)
            => MatchesAt(buffer, 0, signature);

        private static bool MatchesAt(byte[] buffer, int offset, byte[] signature)
        {
            if (buffer.Length < offset + signature.Length)
                return false;

            for (var index = 0; index < signature.Length; index++)
            {
                if (buffer[offset + index] != signature[index])
                    return false;
            }

            return true;
        }
    }
}
