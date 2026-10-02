using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class IncomeRequestDTO : BaseFinancialDTO
    {
        public ICollection<Guid> TemporaryAttachmentIds { get; set; } = new List<Guid>();
    }
}
