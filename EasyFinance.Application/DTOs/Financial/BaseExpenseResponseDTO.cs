using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class BaseExpenseResponseDTO : BaseFinancialDTO
    {
        public bool IsDeductible { get; set; }
        public ICollection<ExpenseItemResponseDTO> Items { get; set; } = new List<ExpenseItemResponseDTO>();
    }
}
