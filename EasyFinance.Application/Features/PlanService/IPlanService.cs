using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;

namespace EasyFinance.Application.Features.PlanService
{
    public interface IPlanService
    {
        Task<AppResponse<ICollection<PlanResponseDTO>>> GetPlansAsync(Guid projectId);
        Task<AppResponse<PlanResponseDTO>> CreatePlanAsync(Guid projectId, PlanRequestDTO requestDto);
        Task<AppResponse<PlanResponseDTO>> UpdatePlanAsync(Guid projectId, Guid planId, JsonPatchDocument<PlanRequestDTO> requestDto);
        Task<AppResponse> ArchivePlanAsync(Guid projectId, Guid planId);
        Task<AppResponse<ICollection<PlanEntryResponseDTO>>> GetEntriesAsync(Guid projectId, Guid planId);
        Task<AppResponse<PlanEntryResponseDTO>> AddEntryAsync(Guid projectId, Guid planId, PlanEntryRequestDTO requestDto);
    }
}
