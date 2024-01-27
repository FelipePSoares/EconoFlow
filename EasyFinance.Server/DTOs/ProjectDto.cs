using EasyFinance.Domain.Models.Financial;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Server.DTOs
{
    public class ProjectDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public ProjectType Type { get; set; }
        public ICollection<Category> Categories { get; set; } = new List<Category>();
        public ICollection<Income> Incomes { get; set; } = new List<Income>();
    }
}
