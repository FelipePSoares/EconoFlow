namespace EasyFinance.Server.DTOs.Financial
{
    public class BaseExpenseRequestDTO : BaseFinancialDTO
    {
        public ICollection<ExpenseItemRequestDTO> Items { get; set; } = new List<ExpenseItemRequestDTO>();
    }
}
