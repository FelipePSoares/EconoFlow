namespace EasyFinance.Server.DTOs.Financial
{
    public class BaseExpenseResponseDTO : BaseFinancialDTO
    {
        public ICollection<ExpenseItemResponseDTO> Items { get; set; } = new List<ExpenseItemResponseDTO>();
    }
}
