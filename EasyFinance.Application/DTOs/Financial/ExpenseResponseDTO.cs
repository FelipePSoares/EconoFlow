using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class ExpenseResponseDTO : BaseExpenseResponseDTO
    {
        public Guid Id { get; set; }
        public int Budget { get; set; }
        public ICollection<AttachmentResponseDTO> Attachments { get; set; } = new List<AttachmentResponseDTO>();
    }
}
