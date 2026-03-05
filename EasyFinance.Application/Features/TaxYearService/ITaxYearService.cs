using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Infrastructure.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.TaxYearService
{
    public interface ITaxYearService
    {
        Task<AppResponse<ProjectTaxYearSettingsResponseDTO>> UpsertTaxYearSettingsAsync(Guid projectId, ProjectTaxYearSettingsRequestDTO requestDto);
        Task<AppResponse<ProjectTaxYearSettingsResponseDTO>> GetTaxYearSettingsAsync(Guid projectId);
        Task<AppResponse<ICollection<TaxYearPeriodResponseDTO>>> GetTaxYearsAsync(Guid projectId);
        Task<AppResponse<ICollection<DeductibleGroupResponseDTO>>> GetDeductibleGroupsAsync(Guid projectId, string taxYearId);
        Task<AppResponse<DeductibleGroupResponseDTO>> CreateDeductibleGroupAsync(Guid projectId, string taxYearId, DeductibleGroupRequestDTO requestDto);
        Task<AppResponse<DeductibleGroupResponseDTO>> UpdateDeductibleGroupAsync(Guid projectId, string taxYearId, Guid groupId, DeductibleGroupRequestDTO requestDto);
        Task<AppResponse> DeleteDeductibleGroupAsync(Guid projectId, string taxYearId, Guid groupId);
        Task<AppResponse<ICollection<DeductibleGroupExpenseResponseDTO>>> GetGroupExpensesAsync(Guid projectId, string taxYearId, Guid groupId);
        Task<AppResponse> AssignExpenseToGroupAsync(Guid projectId, string taxYearId, Guid groupId, Guid? expenseId, Guid? expenseItemId);
        Task<AppResponse> RemoveExpenseFromGroupAsync(Guid projectId, string taxYearId, Guid groupId, Guid? expenseId, Guid? expenseItemId);
        Task<AppResponse<DeductibleGroupTotalsResponseDTO>> GetTotalsAsync(Guid projectId, string taxYearId);
    }
}
