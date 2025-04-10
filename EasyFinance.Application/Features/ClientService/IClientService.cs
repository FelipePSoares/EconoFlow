using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;

namespace EasyFinance.Application.Features.ProjectService
{
    public interface IClientService
    {
        Task<AppResponse<IEnumerable<ClientResponseDTO>>> GetAllAsync(Guid projectId);
        Task<AppResponse<ClientResponseDTO>> GetByIdAsync(Guid clientId);

        Task<AppResponse<ClientResponseDTO>> CreateAsync(Guid projectId, Client client);
        Task<AppResponse<ClientResponseDTO>> UpdateAsync(Guid clientId, JsonPatchDocument<ClientRequestDTO> clientDto);

        Task<AppResponse<ClientResponseDTO>> ActivateAsync(Guid id);
        Task<AppResponse> DeactivateAsync(Guid id);
        Task<AppResponse> ArchiveAsync(Guid id);
    }
}
