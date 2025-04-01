using EasyFinance.Domain.FinancialProject;

namespace EasyFinance.Application.DTOs.FinancialProject
{
    public class ProjectRequestDTO
    {
        public string Name { get; set; } = string.Empty;
        public string PreferredCurrency { get; set; } = string.Empty;
        public ProjectTypes Type { get; set; } = ProjectTypes.Personal;
    }
}
