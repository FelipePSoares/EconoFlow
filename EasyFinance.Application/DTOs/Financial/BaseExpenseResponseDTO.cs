using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class BaseExpenseResponseDTO : BaseFinancialDTO
    {
        public ICollection<ExpenseItemResponseDTO> Items { get; set; } = new List<ExpenseItemResponseDTO>();
    }
}
