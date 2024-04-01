using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Server.DTOs;

namespace EasyFinance.Server.Mappers
{
    public static class ProjectMap
    {
        public static IEnumerable<ProjectResponseDTO> ToDTO(this ICollection<Project> projects) => projects.Select(p => p.ToDTO());

        public static ProjectResponseDTO ToDTO(this Project project)
        {
            ArgumentNullException.ThrowIfNull(project);

            return new ProjectResponseDTO()
            {
                Id = project.Id,
                Name = project.Name,
                Type = project.Type
            };
        }

        public static ProjectRequestDTO ToRequestDTO(this Project project)
        {
            ArgumentNullException.ThrowIfNull(project);

            return new ProjectRequestDTO()
            {
                Name = project.Name,
                Type = project.Type
            };
        }

        public static IEnumerable<Project> FromDTO(this ICollection<ProjectRequestDTO> projects) => projects.Select(p => p.FromDTO());

        public static Project FromDTO(this ProjectRequestDTO projectDTO)
        {
            ArgumentNullException.ThrowIfNull(projectDTO);

            return new Project(name: projectDTO.Name, type: projectDTO.Type);
        }
    }
}
