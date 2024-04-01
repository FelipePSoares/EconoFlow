using System.Text.Json.Serialization;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Server.DTOs
{
    public class ProjectRequestDTO
    {
        public string Name { get; set; } = string.Empty;
        public ProjectType Type { get; set; }
    }
}
