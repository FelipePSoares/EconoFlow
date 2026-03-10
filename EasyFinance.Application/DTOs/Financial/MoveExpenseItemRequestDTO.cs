using System;

namespace EasyFinance.Application.DTOs.Financial
{
    public class MoveExpenseItemRequestDTO
    {
        public Guid TargetCategoryId { get; set; }
        public Guid TargetExpenseId { get; set; }
    }
}
