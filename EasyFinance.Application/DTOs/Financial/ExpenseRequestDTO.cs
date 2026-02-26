using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class ExpenseRequestDTO : BaseExpenseRequestDTO
    {
        public int Budget { get; set; }
        public bool IsDeductible { get; set; }
        public ICollection<Guid> TemporaryAttachmentIds { get; set; } = new List<Guid>();
    }
}
