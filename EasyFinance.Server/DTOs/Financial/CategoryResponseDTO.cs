using EasyFinance.Domain.Models.Financial;

namespace EasyFinance.Server.DTOs.Financial
{
    public class CategoryResponseDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public int Goal { get; set; }
        public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    }
}
