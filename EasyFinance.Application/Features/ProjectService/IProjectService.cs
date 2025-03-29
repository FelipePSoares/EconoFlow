using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;

namespace EasyFinance.Application.Features.ProjectService
{
    public interface IProjectService
    {
        AppResponse<ICollection<UserProjectResponseDTO>> GetAll(Guid userId);

        AppResponse<UserProjectResponseDTO> GetById(Guid userId, Guid projectId);

        Task<AppResponse<ProjectResponseDTO>> CreateAsync(User user, Project project);

        Task<AppResponse<ProjectResponseDTO>> UpdateAsync(Project project);
        Task<AppResponse<ProjectResponseDTO>> UpdateAsync(Guid projectId, JsonPatchDocument<ProjectRequestDTO> projectDto);

        Task<AppResponse> ArchiveAsync(Guid id);

        Task<AppResponse<ICollection<ExpenseResponseDTO>>> CopyBudgetFromPreviousMonthAsync(User user, Guid id, DateTime currentDate);

        Task<AppResponse> DeleteOrRemoveLinkAsync(User user);

        Task<AppResponse<IList<string>>> GetProjectsWhereUserIsSoleAdminAsync(User user);

        Task<AppResponse<ICollection<TransactionResponseDTO>>> GetLatestAsync(Guid projectId, int numberOfTransactions);
    }
}
