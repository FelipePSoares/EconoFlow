﻿using System;
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
        Task<AppResponse<IEnumerable<UserProjectResponseDTO>>> UpdateAccessAsync(Guid projectId, JsonPatchDocument<IEnumerable<UserProjectRequestDTO>> userProjectDto);
    }
}
