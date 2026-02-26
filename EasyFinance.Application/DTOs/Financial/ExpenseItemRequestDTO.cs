using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class ExpenseItemRequestDTO : BaseExpenseRequestDTO
    {
        public ICollection<Guid> TemporaryAttachmentIds { get; set; } = new List<Guid>();
    }
}
