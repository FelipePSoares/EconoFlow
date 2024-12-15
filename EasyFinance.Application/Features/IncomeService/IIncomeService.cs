using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;

namespace EasyFinance.Application.Features.IncomeService
{
    public interface IIncomeService
    {
        AppResponse<ICollection<IncomeResponseDTO>> GetAll(Guid projectId);
        AppResponse<ICollection<IncomeResponseDTO>> Get(Guid projectId, DateTime from, DateTime to);
        Task<AppResponse<ICollection<IncomeResponseDTO>>> GetAsync(Guid projectId, int year);
        AppResponse<IncomeResponseDTO> GetById(Guid incomeId);
        Task<AppResponse<IncomeResponseDTO>> CreateAsync(User user, Guid projectId, Income income);
        Task<AppResponse<IncomeResponseDTO>> UpdateAsync(Income income);
        Task<AppResponse<IncomeResponseDTO>> UpdateAsync(Guid incomeId, JsonPatchDocument<IncomeRequestDTO> incomeDto);
        Task<AppResponse> DeleteAsync(Guid incomeId);
        Task<AppResponse> RemoveLinkAsync(User user);
    }
}
