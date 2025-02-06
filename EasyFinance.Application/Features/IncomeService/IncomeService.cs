using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.IncomeService
{
    public class IncomeService : IIncomeService
    {
        private readonly IUnitOfWork unitOfWork;

        public IncomeService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
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
            var result = unitOfWork.IncomeRepository.Trackable().FirstOrDefault(p => p.Id == incomeId);

            return AppResponse<IncomeResponseDTO>.Success(result.ToDTO());
        }

        public async Task<AppResponse<IncomeResponseDTO>> CreateAsync(User user, Guid projectId, Income income)
        {
            if (income == default)
                return AppResponse<IncomeResponseDTO>.Error(code: nameof(income), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(income)));

            if (user == default)
                return AppResponse<IncomeResponseDTO>.Error(code: nameof(user), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

            income.SetCreatedBy(user);

            var project = unitOfWork.ProjectRepository.Trackable().Include(p => p.Incomes).FirstOrDefault(p => p.Id == projectId);

            this.unitOfWork.IncomeRepository.InsertOrUpdate(income);
            project.Incomes.Add(income);
            this.unitOfWork.ProjectRepository.InsertOrUpdate(project);

            await unitOfWork.CommitAsync();

            return AppResponse<IncomeResponseDTO>.Success(income.ToDTO());
        }

        public async Task<AppResponse<IncomeResponseDTO>> UpdateAsync(Income income)
        {
            if (income == default)
                return AppResponse<IncomeResponseDTO>.Error(code: nameof(income), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(income)));

            unitOfWork.IncomeRepository.InsertOrUpdate(income);
            await unitOfWork.CommitAsync();

            return AppResponse<IncomeResponseDTO>.Success(income.ToDTO());
        }

        public async Task<AppResponse<IncomeResponseDTO>> UpdateAsync(Guid incomeId, JsonPatchDocument<IncomeRequestDTO> incomeDto)
        {
            var existingIncome = unitOfWork.IncomeRepository.Trackable().FirstOrDefault(p => p.Id == incomeId);

            if (existingIncome == null)
                return AppResponse<IncomeResponseDTO>.Error(code: ValidationMessages.NotFound, description: ValidationMessages.IncomeNotFound);

            var dto = existingIncome.ToRequestDTO();

            incomeDto.ApplyTo(dto);

            dto.FromDTO(existingIncome);

            return await UpdateAsync(existingIncome);
        }

        public async Task<AppResponse> DeleteAsync(Guid incomeId)
        {
            if (incomeId == Guid.Empty)
                return AppResponse.Error(code: nameof(incomeId), description: ValidationMessages.InvalidIncomeId);

            var income = unitOfWork.IncomeRepository.Trackable().FirstOrDefault(i => i.Id == incomeId);

            if (income == null)
                return AppResponse.Error(code: ValidationMessages.NotFound, description: ValidationMessages.IncomeNotFound);

            unitOfWork.IncomeRepository.Delete(income);
            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse> RemoveLinkAsync(User user)
        {
            var incomes = unitOfWork.IncomeRepository.Trackable().Where(income => income.CreatedBy.Id == user.Id).ToList();

            foreach (var income in incomes)
            {
                income.RemoveUserLink($"{user.FirstName} {user.LastName}");
                unitOfWork.IncomeRepository.InsertOrUpdate(income);
            }

            await unitOfWork.CommitAsync();
            return AppResponse.Success();
        }
    }
}
