using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class IncomeResponseDTO : BaseFinancialDTO
    {
        public Guid Id { get; set; }
        public ICollection<AttachmentResponseDTO> Attachments { get; set; } = new List<AttachmentResponseDTO>();
    }
}
