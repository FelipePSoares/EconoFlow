using EasyFinance.Domain.Financial;

namespace EasyFinance.Server.DTOs.Financial
{
    public class CategoryResponseDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    }
}
