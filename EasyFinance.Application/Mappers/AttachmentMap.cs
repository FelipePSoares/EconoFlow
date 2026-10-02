using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Domain.Financial;

namespace EasyFinance.Application.Mappers
{
    public static class AttachmentMap
    {
        public static ICollection<AttachmentResponseDTO> ToAttachmentDTO(this IEnumerable<Attachment> attachments)
            => attachments?.Select(attachment => attachment.ToAttachmentDTO()).ToList()
               ?? [];

        public static AttachmentResponseDTO ToAttachmentDTO(this Attachment attachment)
        {
            ArgumentNullException.ThrowIfNull(attachment);

            return new()
            {
                Id = attachment.Id,
                Name = attachment.Name,
                ContentType = attachment.ContentType,
                Size = attachment.Size,
                AttachmentType = attachment.AttachmentType,
                IsTemporary = attachment.IsTemporary
            };
        }
    }
}
