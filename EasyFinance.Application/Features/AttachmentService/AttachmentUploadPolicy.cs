using System;
using System.Collections.Generic;

namespace EasyFinance.Application.Features.AttachmentService
{
    public static class AttachmentUploadPolicy
    {
        public const long MaxAttachmentSizeBytes = 10 * 1024 * 1024; // 10 MB

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

        public static bool IsAllowedContentType(string contentType)
        {
            if (string.IsNullOrWhiteSpace(contentType))
                return false;

            return allowedContentTypes.Contains(contentType.Trim());
        }

        public static string AllowedContentTypesDescription
            => string.Join(", ", allowedContentTypes);
    }
}
