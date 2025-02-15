using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.AccessControlService
{
    public class AccessControlService : IAccessControlService
    {
        private readonly IUnitOfWork unitOfWork;

        public AccessControlService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public bool HasAuthorization(Guid userId, Guid projectId, Role accessNeeded)
        {
            var access = this.unitOfWork.UserProjectRepository.NoTrackable().FirstOrDefault(up => up.User.Id == userId && up.Project.Id == projectId);

            return access != null && access.Role >= accessNeeded;
        }

        public async Task<AppResponse<IEnumerable<UserProjectResponseDTO>>> UpdateAccessAsync(User user, Guid projectId, JsonPatchDocument<IList<UserProjectRequestDTO>> userProjectsDto)
        {
            if (!this.HasAuthorization(user.Id, projectId, Role.Admin))
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(code: ValidationMessages.Forbidden, description: ValidationMessages.Forbidden);

            var project = unitOfWork.ProjectRepository.NoTrackable().FirstOrDefault(up => up.Id == projectId);
            var existingUserProject = unitOfWork.UserProjectRepository.Trackable().Include(up => up.User).Include(up => up.Project).Where(up => up.Project.Id == projectId).ToList();

            if (userProjectsDto.Operations.Count == 0)
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Success(existingUserProject.ToDTO());

            var dto = existingUserProject.ToRequestDTO().ToList();

            userProjectsDto.ApplyTo(dto);

            var result = dto.FromDTO(project, existingUserProject);

            if (!result.Any(r => r.Role == Role.Admin))
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(description: ValidationMessages.AdminRequired);

            return await this.BulkyUpdateAsync(result);
        }

        private async Task<AppResponse<IEnumerable<UserProjectResponseDTO>>> BulkyUpdateAsync(IEnumerable<UserProject> userProjects)
        {
            if (userProjects == default)
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(code: nameof(userProjects), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(userProjects)));

            foreach (var userProject in userProjects)
                unitOfWork.UserProjectRepository.InsertOrUpdate(userProject);

            await unitOfWork.CommitAsync();

            return AppResponse<IEnumerable<UserProjectResponseDTO>>.Success(userProjects.ToDTO());
        }
    }
}
