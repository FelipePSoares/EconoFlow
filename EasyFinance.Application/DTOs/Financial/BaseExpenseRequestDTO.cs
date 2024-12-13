using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class BaseExpenseRequestDTO : BaseFinancialDTO
    {
        public ICollection<ExpenseItemRequestDTO> Items { get; set; } = new List<ExpenseItemRequestDTO>();
    }
}
