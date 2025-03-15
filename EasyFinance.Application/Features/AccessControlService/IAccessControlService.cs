using System;
using EasyFinance.Application.DTOs.AccessControl;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;

namespace EasyFinance.Application.Features.AccessControlService
{
    public interface IAccessControlService
    {
        bool HasAuthorization(Guid userId, Guid projectId, Role accessNeeded);
        Task<AppResponse<IEnumerable<UserProjectResponseDTO>>> UpdateAccessAsync(User user, Guid projectId, JsonPatchDocument<IList<UserProjectRequestDTO>> userProjectDto);
        Task<AppResponse> AcceptInvitationAsync(User user, Guid token);
        Task<AppResponse<IEnumerable<UserProjectResponseDTO>>> GetUsers(User user, Guid value);
        Task<AppResponse<IEnumerable<UserResponseDTO>>> GetAllKnowUsersAsync(User user, Guid? projectId);
        Task<AppResponse> RemoveAccessAsync(Guid userProjectId);
    }
}
