using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using FpsSoftware.Chassis;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.Features.IncomeService
{
    public class IncomeService : IIncomeService
    {
        private readonly IUnitOfWork unitOfWork;
        private readonly IAttachmentService attachmentService;
        private readonly ILogger<IncomeService> logger;

        public IncomeService(IUnitOfWork unitOfWork, IAttachmentService attachmentService, ILogger<IncomeService> logger)
        {
            this.unitOfWork = unitOfWork;
            this.attachmentService = attachmentService;
            this.logger = logger;
        }

        public AppResponse<ICollection<IncomeResponseDTO>> GetAll(Guid projectId)
        {
            var result =
                unitOfWork.ProjectRepository
                .NoTrackable()
                .Include(p => p.Incomes)
                .FirstOrDefault(p => p.Id == projectId)
                .Incomes
                .ToDTO()
                .ToList();

            return AppResponse<ICollection<IncomeResponseDTO>>.Success(result);
        }

        public AppResponse<ICollection<IncomeResponseDTO>> Get(Guid projectId, DateOnly from, DateOnly to)
        {
            var result =
                unitOfWork
                .ProjectRepository
                .NoTrackable()
                .Include(p => p.Incomes.Where(e => e.Date >= from && e.Date < to))
                    .ThenInclude(income => income.Attachments)
                .FirstOrDefault(p => p.Id == projectId)
                .Incomes
                .ToDTO()
                .ToList();

            return AppResponse<ICollection<IncomeResponseDTO>>.Success(result);
        }

        public async Task<AppResponse<ICollection<IncomeResponseDTO>>> GetAsync(Guid projectId, int year)
        {
            var result =
                (await unitOfWork.ProjectRepository
                .NoTrackable()
                .Include(p => p.Incomes.Where(e => e.Date.Year == year))
                .FirstOrDefaultAsync(p => p.Id == projectId))
                .Incomes
                .ToDTO()
                .ToList();

            return AppResponse<ICollection<IncomeResponseDTO>>.Success(result);
        }

        public AppResponse<IncomeResponseDTO> GetById(Guid incomeId)
        {
            var result = unitOfWork.IncomeRepository
                .Trackable()
                .Include(e => e.Attachments)
                .FirstOrDefault(p => p.Id == incomeId);

            return AppResponse<IncomeResponseDTO>.Success(result.ToDTO());
        }

        public async Task<AppResponse<IncomeResponseDTO>> CreateAsync(User user, Guid projectId, IncomeRequestDTO incomeDto)
        {
            if (incomeDto == default)
                return AppResponse<IncomeResponseDTO>.Error(code: nameof(incomeDto), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(incomeDto)));

            if (user == default)
                return AppResponse<IncomeResponseDTO>.Error(code: nameof(user), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

            var income = incomeDto.FromDTO();
            income.SetCreatedBy(user);

            var project = unitOfWork.ProjectRepository.Trackable().Include(p => p.Incomes).FirstOrDefault(p => p.Id == projectId);

            var savedIncome = this.unitOfWork.IncomeRepository.InsertOrUpdate(income);
            if (savedIncome.Failed)
                return AppResponse<IncomeResponseDTO>.Error(savedIncome.Messages);

            project.Incomes.Add(income);

            var savedProject = this.unitOfWork.ProjectRepository.InsertOrUpdate(project);
            if (savedProject.Failed)
                return AppResponse<IncomeResponseDTO>.Error(savedProject.Messages);

            // Link before the single commit so a rejected attachment id never leaves a persisted
            // income behind for the caller to duplicate on retry.
            var linkResponse = await this.attachmentService.LinkTemporaryAttachmentsToIncomeAsync(
                income,
                user,
                incomeDto.TemporaryAttachmentIds);

            if (linkResponse.Failed)
                return AppResponse<IncomeResponseDTO>.Error(linkResponse.Messages);

            await unitOfWork.CommitAsync();

            var persistedIncome = await this.unitOfWork.IncomeRepository
                .NoTrackable()
                .Include(e => e.Attachments)
                .FirstOrDefaultAsync(e => e.Id == income.Id);

            return AppResponse<IncomeResponseDTO>.Success(persistedIncome.ToDTO());
        }

        public async Task<AppResponse<IncomeResponseDTO>> UpdateAsync(Income income)
        {
            if (income == default)
                return AppResponse<IncomeResponseDTO>.Error(code: nameof(income), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(income)));

            var savedIncome = this.unitOfWork.IncomeRepository.InsertOrUpdate(income);
            if (savedIncome.Failed)
                return AppResponse<IncomeResponseDTO>.Error(savedIncome.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse<IncomeResponseDTO>.Success(income.ToDTO());
        }

        public async Task<AppResponse<IncomeResponseDTO>> UpdateAsync(User user, Guid projectId, Guid incomeId, JsonPatchDocument<IncomeRequestDTO> incomeDto)
        {
            var existingIncome = unitOfWork.IncomeRepository
                .Trackable()
                .Include(e => e.Attachments)
                .Include(e => e.CreatedBy)
                .FirstOrDefault(p => p.Id == incomeId) ?? throw new KeyNotFoundException(ValidationMessages.IncomeNotFound);

            var dto = existingIncome.ToRequestDTO();

            incomeDto.ApplyTo(dto);

            dto.FromDTO(existingIncome);

            // Same reasoning as CreateAsync: link before the single commit of this write path.
            var linkResponse = await this.attachmentService.LinkTemporaryAttachmentsToIncomeAsync(
                existingIncome,
                user,
                dto.TemporaryAttachmentIds);

            if (linkResponse.Failed)
                return AppResponse<IncomeResponseDTO>.Error(linkResponse.Messages);

            var updateResponse = await UpdateAsync(existingIncome);
            if (updateResponse.Failed)
                return updateResponse;

            var persistedIncome = await this.unitOfWork.IncomeRepository
                .NoTrackable()
                .Include(e => e.Attachments)
                .FirstOrDefaultAsync(e => e.Id == incomeId);

            return AppResponse<IncomeResponseDTO>.Success(persistedIncome.ToDTO());
        }

        public async Task<AppResponse> DeleteAsync(Guid incomeId)
        {
            if (incomeId == Guid.Empty)
                return AppResponse.Error(code: nameof(incomeId), description: ValidationMessages.InvalidIncomeId);

            var income = unitOfWork.IncomeRepository.Trackable().FirstOrDefault(i => i.Id == incomeId);

            if (income == null)
            {
                logger.LogWarning("Income not found for soft deletion!");
                return AppResponse.Success();
            }

            income.SetDeleted();
            unitOfWork.IncomeRepository.InsertOrUpdate(income);
            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse> RestoreAsync(Guid incomeId)
        {
            if (incomeId == Guid.Empty)
                return AppResponse.Error(code: nameof(incomeId), description: ValidationMessages.InvalidIncomeId);

            var income = unitOfWork.IncomeRepository
                .Trackable()
                .IgnoreQueryFilters()
                .FirstOrDefault(i => i.Id == incomeId);

            if (income == null)
                return AppResponse.Success();

            income.SetRestored();
            unitOfWork.IncomeRepository.InsertOrUpdate(income);
            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse> RemoveLinkAsync(User user)
        {
            var result = AppResponse.Success();

            var incomes = unitOfWork.IncomeRepository
                .Trackable()
                .Include(e => e.CreatedBy)
                .Where(income => income.CreatedBy.Id == user.Id).ToList();

            foreach (var income in incomes)
            {
                income.RemoveUserLink();
                var savedIncome = unitOfWork.IncomeRepository.InsertOrUpdate(income);
                if (savedIncome.Failed)
                    result.AddErrorMessage(savedIncome.Messages);
            }

            await unitOfWork.CommitAsync();
            return result;
        }
    }
}
