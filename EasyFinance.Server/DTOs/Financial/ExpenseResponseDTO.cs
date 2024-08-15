namespace EasyFinance.Server.DTOs.Financial
{
    public class ExpenseResponseDTO : BaseExpenseResponseDTO
    {
        public Guid Id { get; set; }
        public int Goal { get; set; }
    }
}
