using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.PlanService
{
    public class PlanService : IPlanService
    {
        private readonly IUnitOfWork unitOfWork;

        public PlanService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public async Task<AppResponse<ICollection<PlanResponseDTO>>> GetPlansAsync(Guid projectId)
        {
            if (projectId == Guid.Empty)
                return AppResponse<ICollection<PlanResponseDTO>>.Error(nameof(projectId), ValidationMessages.InvalidProjectId);

            var plans = await this.unitOfWork.PlanRepository
                .NoTrackable()
                .Where(plan => plan.ProjectId == projectId)
                .OrderBy(plan => plan.Name)
                .ToListAsync();

            return AppResponse<ICollection<PlanResponseDTO>>.Success(plans.ToDTO().ToList());
        }

        public async Task<AppResponse<PlanResponseDTO>> CreatePlanAsync(Guid projectId, PlanRequestDTO requestDto)
        {
            if (requestDto == null)
                return AppResponse<PlanResponseDTO>.Error(nameof(requestDto), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(requestDto)));

            if (projectId == Guid.Empty)
                return AppResponse<PlanResponseDTO>.Error(nameof(projectId), ValidationMessages.InvalidProjectId);

            var projectExists = await this.unitOfWork.ProjectRepository
                .NoTrackable()
                .AnyAsync(project => project.Id == projectId);

            if (!projectExists)
                throw new KeyNotFoundException(ValidationMessages.ProjectNotFound);

            if (requestDto.Type == PlanType.EmergencyReserve && await this.HasActiveEmergencyReserveAsync(projectId))
                return AppResponse<PlanResponseDTO>.Error(nameof(requestDto.Type), ValidationMessages.OnlyOneEmergencyReservePerProject);

            var newPlan = new Plan(
                projectId: projectId,
                type: requestDto.Type,
                name: requestDto.Name,
                targetAmount: requestDto.TargetAmount,
                currentBalance: 0m);

            var savePlan = this.unitOfWork.PlanRepository.InsertOrUpdate(newPlan);
            if (savePlan.Failed)
                return AppResponse<PlanResponseDTO>.Error(savePlan.Messages);

            await this.unitOfWork.CommitAsync();

            return AppResponse<PlanResponseDTO>.Success(newPlan.ToDTO());
        }

        public async Task<AppResponse<PlanResponseDTO>> UpdatePlanAsync(Guid projectId, Guid planId, JsonPatchDocument<PlanRequestDTO> requestDto)
        {
            if (requestDto == null)
                return AppResponse<PlanResponseDTO>.Error(nameof(requestDto), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(requestDto)));

            if (projectId == Guid.Empty)
                return AppResponse<PlanResponseDTO>.Error(nameof(projectId), ValidationMessages.InvalidProjectId);

            if (planId == Guid.Empty)
                return AppResponse<PlanResponseDTO>.Error(nameof(planId), ValidationMessages.InvalidData);

            var plan = await this.unitOfWork.PlanRepository
                .Trackable()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(existingPlan => existingPlan.Id == planId && existingPlan.ProjectId == projectId)
                ?? throw new KeyNotFoundException(ValidationMessages.ResourceNotFound);

            if (plan.IsArchived)
                return AppResponse<PlanResponseDTO>.Error(nameof(planId), ValidationMessages.InvalidData);

            var dto = plan.ToRequestDTO();
            requestDto.ApplyTo(dto);

            if (dto.Type == PlanType.EmergencyReserve && await this.HasActiveEmergencyReserveAsync(projectId, plan.Id))
                return AppResponse<PlanResponseDTO>.Error(nameof(PlanRequestDTO.Type), ValidationMessages.OnlyOneEmergencyReservePerProject);

            dto.FromDTO(plan);

            var savePlan = this.unitOfWork.PlanRepository.InsertOrUpdate(plan);
            if (savePlan.Failed)
                return AppResponse<PlanResponseDTO>.Error(savePlan.Messages);

            await this.unitOfWork.CommitAsync();

            return AppResponse<PlanResponseDTO>.Success(plan.ToDTO());
        }

        public async Task<AppResponse> ArchivePlanAsync(Guid projectId, Guid planId)
        {
            if (projectId == Guid.Empty)
                return AppResponse.Error(nameof(projectId), ValidationMessages.InvalidProjectId);

            if (planId == Guid.Empty)
                return AppResponse.Error(nameof(planId), ValidationMessages.InvalidData);

            var plan = await this.unitOfWork.PlanRepository
                .Trackable()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(existingPlan => existingPlan.Id == planId && existingPlan.ProjectId == projectId)
                ?? throw new KeyNotFoundException(ValidationMessages.ResourceNotFound);

            if (plan.IsArchived)
                return AppResponse.Success();

            plan.SetArchive();

            var savePlan = this.unitOfWork.PlanRepository.InsertOrUpdate(plan);
            if (savePlan.Failed)
                return AppResponse.Error(savePlan.Messages);

            await this.unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse<ICollection<PlanEntryResponseDTO>>> GetEntriesAsync(Guid projectId, Guid planId)
        {
            if (projectId == Guid.Empty)
                return AppResponse<ICollection<PlanEntryResponseDTO>>.Error(nameof(projectId), ValidationMessages.InvalidProjectId);

            if (planId == Guid.Empty)
                return AppResponse<ICollection<PlanEntryResponseDTO>>.Error(nameof(planId), ValidationMessages.InvalidData);

            var planExists = await this.unitOfWork.PlanRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .AnyAsync(plan => plan.ProjectId == projectId && plan.Id == planId);

            if (!planExists)
                throw new KeyNotFoundException(ValidationMessages.ResourceNotFound);

            var entries = await this.unitOfWork.PlanEntryRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Where(entry => entry.PlanId == planId)
                .OrderByDescending(entry => entry.Date)
                .ThenByDescending(entry => entry.CreatedDate)
                .ToListAsync();

            return AppResponse<ICollection<PlanEntryResponseDTO>>.Success(entries.ToDTO().ToList());
        }

        public async Task<AppResponse<PlanEntryResponseDTO>> AddEntryAsync(Guid projectId, Guid planId, PlanEntryRequestDTO requestDto)
        {
            if (requestDto == null)
                return AppResponse<PlanEntryResponseDTO>.Error(nameof(requestDto), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(requestDto)));

            if (projectId == Guid.Empty)
                return AppResponse<PlanEntryResponseDTO>.Error(nameof(projectId), ValidationMessages.InvalidProjectId);

            if (planId == Guid.Empty)
                return AppResponse<PlanEntryResponseDTO>.Error(nameof(planId), ValidationMessages.InvalidData);

            var plan = await this.unitOfWork.PlanRepository
                .Trackable()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(existingPlan => existingPlan.Id == planId && existingPlan.ProjectId == projectId)
                ?? throw new KeyNotFoundException(ValidationMessages.ResourceNotFound);

            if (plan.IsArchived)
                return AppResponse<PlanEntryResponseDTO>.Error(nameof(planId), ValidationMessages.InvalidData);

            var newEntry = new PlanEntry(
                planId: planId,
                date: requestDto.Date,
                amountSigned: requestDto.AmountSigned,
                note: requestDto.Note);

            var saveEntry = this.unitOfWork.PlanEntryRepository.InsertOrUpdate(newEntry);
            if (saveEntry.Failed)
                return AppResponse<PlanEntryResponseDTO>.Error(saveEntry.Messages);

            plan.ApplyEntry(newEntry.AmountSigned);
            var savePlan = this.unitOfWork.PlanRepository.InsertOrUpdate(plan);
            if (savePlan.Failed)
                return AppResponse<PlanEntryResponseDTO>.Error(savePlan.Messages);

            await this.unitOfWork.CommitAsync();

            return AppResponse<PlanEntryResponseDTO>.Success(newEntry.ToDTO());
        }

        private async Task<bool> HasActiveEmergencyReserveAsync(Guid projectId, Guid? excludedPlanId = null)
        {
            var query = this.unitOfWork.PlanRepository
                .NoTrackable()
                .Where(plan => plan.ProjectId == projectId && plan.Type == PlanType.EmergencyReserve);

            if (excludedPlanId.HasValue)
                query = query.Where(plan => plan.Id != excludedPlanId.Value);

            return await query.AnyAsync();
        }
    }
}
