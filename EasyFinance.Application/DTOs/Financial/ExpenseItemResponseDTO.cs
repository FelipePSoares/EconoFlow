using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class ExpenseItemResponseDTO : BaseExpenseResponseDTO
    {
        public Guid Id { get; set; }
        public ICollection<ExpenseAttachmentResponseDTO> Attachments { get; set; } = new List<ExpenseAttachmentResponseDTO>();
    }
}
