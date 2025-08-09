using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Domain.FinancialProject;

namespace EasyFinance.Application.Mappers
{
    public static class ProjectMap
    {
        public static IEnumerable<ProjectResponseDTO> ToDTO(this ICollection<Project> projects) => projects.Select(p => p.ToDTO());
        public static IEnumerable<ProjectResponseDTO> ToDTO(this IEnumerable<Project> projects) => projects.Select(p => p.ToDTO());

        public static ProjectResponseDTO ToDTO(this Project project)
        {
            ArgumentNullException.ThrowIfNull(project);

            return new ProjectResponseDTO()
            {
                Id = project.Id,
                Name = project.Name,
                PreferredCurrency = project.PreferredCurrency
            };
        }

        public static ProjectRequestDTO ToRequestDTO(this Project project)
        {
            ArgumentNullException.ThrowIfNull(project);

            return new ProjectRequestDTO()
            {
                Name = project.Name,
                PreferredCurrency = project.PreferredCurrency
            };
        }

        public static IEnumerable<Project> FromDTO(this ICollection<ProjectRequestDTO> projects) => projects.Select(p => p.FromDTO());

        public static Project FromDTO(this ProjectRequestDTO projectDTO, Project existingProject = null)
        {
            ArgumentNullException.ThrowIfNull(projectDTO);

            if (existingProject != null)
            {
                existingProject.SetName(projectDTO.Name);
                existingProject.SetPreferredCurrency(projectDTO.PreferredCurrency);
                return existingProject;
            }

            return new Project(name: projectDTO.Name, preferredCurrency: projectDTO.PreferredCurrency);
        }
    }
}
