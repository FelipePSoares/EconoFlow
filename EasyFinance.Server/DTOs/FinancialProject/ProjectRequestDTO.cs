using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Server.DTOs.FinancialProject
{
    public class ProjectRequestDTO
    {
        public string Name { get; set; } = string.Empty;
        public ProjectType Type { get; set; }
    }
}
