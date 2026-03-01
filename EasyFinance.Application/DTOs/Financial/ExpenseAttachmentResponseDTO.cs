using System;
using EasyFinance.Domain.Financial;

namespace EasyFinance.Application.DTOs.Financial
{
    public class ExpenseAttachmentResponseDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long Size { get; set; }
        public AttachmentType AttachmentType { get; set; } = AttachmentType.General;
        public bool IsTemporary { get; set; }
    }
}
