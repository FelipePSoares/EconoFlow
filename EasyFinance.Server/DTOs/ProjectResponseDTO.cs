using System.Text.Json.Serialization;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Server.DTOs
{
    public class ProjectResponseDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        [JsonConverter(typeof(JsonStringEnumConverter))]
        public ProjectType Type { get; set; }
    }
}
