using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class ExpenseItemResponseDTO : BaseExpenseResponseDTO
    {
        public Guid Id { get; set; }
        public ICollection<AttachmentResponseDTO> Attachments { get; set; } = new List<AttachmentResponseDTO>();
    }
}
