using System.Text.Json.Serialization;
using EasyFinance.Domain.FinancialProject;

namespace EasyFinance.Server.DTOs.FinancialProject
{
    public class ProjectResponseDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public ProjectType Type { get; set; }
    }
}
