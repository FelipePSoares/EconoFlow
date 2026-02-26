using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class ExpenseResponseDTO : BaseExpenseResponseDTO
    {
        public Guid Id { get; set; }
        public int Budget { get; set; }
        public bool IsDeductible { get; set; }
        public ICollection<ExpenseAttachmentResponseDTO> Attachments { get; set; } = new List<ExpenseAttachmentResponseDTO>();
    }
}
