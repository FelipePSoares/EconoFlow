using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class BaseExpenseRequestDTO : BaseFinancialDTO
    {
        public bool IsDeductible { get; set; }
        public ICollection<Guid> TemporaryAttachmentIds { get; set; } = new List<Guid>();
        public ICollection<ExpenseItemRequestDTO> Items { get; set; } = new List<ExpenseItemRequestDTO>();
    }
}
