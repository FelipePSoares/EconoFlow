using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;

namespace EasyFinance.Application.Mappers
{
    public static class UserProjectMap
    {
        public static IEnumerable<UserProjectRequestDTO> ToRequestDTO(this IEnumerable<UserProject> userProjects) => userProjects.Select(p => p.ToRequestDTO());

        public static UserProjectRequestDTO ToRequestDTO(this UserProject userProject)
        {
            ArgumentNullException.ThrowIfNull(userProject);

            return new UserProjectRequestDTO()
            {
                UserId = userProject.User?.Id,
                UserEmail = userProject.User?.Email ?? userProject.Email,
                Role = userProject.Role,
            };
        }

        public static IEnumerable<UserProject> FromDTO(this IEnumerable<UserProjectRequestDTO> userProjectsDTO, Project project, IList<UserProject> userProjects = null)
            => userProjectsDTO.Select((userProjectDTO, index) =>
            {
                if (userProjects != null && index < userProjects.Count)
                    return userProjectDTO.FromDTO(project, userProjects[index]);

                return userProjectDTO.FromDTO(project);
            }).ToList();

        public static UserProject FromDTO(this UserProjectRequestDTO userProjectDTO, Project project, UserProject existingUserProject = null)
        {
            ArgumentNullException.ThrowIfNull(userProjectDTO);

            var user = userProjectDTO.UserId.HasValue ? new User(userProjectDTO.UserId.Value) : null;

            if (existingUserProject != null)
            {
                if (existingUserProject.Role != userProjectDTO.Role)
                    existingUserProject.SetRole(userProjectDTO.Role);

                if (user != null && user.Id != existingUserProject.User.Id)
                    existingUserProject.SetUser(user);

                if (user == null)
                    existingUserProject.SetUser(userProjectDTO.UserEmail);

                if (existingUserProject.Project.Id != project.Id)
                    existingUserProject.SetProject(project);

                return existingUserProject;
            }

            return new UserProject(user, project, userProjectDTO.Role, userProjectDTO.UserEmail);
        }

        public static IEnumerable<UserProjectResponseDTO> ToDTO(this IEnumerable<UserProject> userProjects) => userProjects.Select(p => p.ToDTO());
        public static UserProjectResponseDTO ToDTO(this UserProject userProject)
        {
            ArgumentNullException.ThrowIfNull(userProject);

            return new UserProjectResponseDTO()
            {
                Id = userProject.Id,
                UserId = userProject.User?.Id,
                UserName = userProject.User?.FullName,
                UserEmail = userProject.User?.Email ?? userProject.Email,
                Project = userProject.Project.ToDTO(),
                Role = userProject.Role,
                Accepted = userProject.Accepted
            };
        }
    }
}
;