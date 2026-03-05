using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.TaxYearService
{
    public class TaxYearService : ITaxYearService
    {
        private readonly IUnitOfWork unitOfWork;

        public TaxYearService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public async Task<AppResponse<ProjectTaxYearSettingsResponseDTO>> UpsertTaxYearSettingsAsync(Guid projectId, ProjectTaxYearSettingsRequestDTO requestDto)
        {
            if (requestDto == null)
                return AppResponse<ProjectTaxYearSettingsResponseDTO>.Error(nameof(requestDto), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(requestDto)));

            if (projectId == Guid.Empty)
                return AppResponse<ProjectTaxYearSettingsResponseDTO>.Error(nameof(projectId), ValidationMessages.InvalidProjectId);

            var project = await this.unitOfWork.ProjectRepository
                .Trackable()
                .FirstOrDefaultAsync(p => p.Id == projectId) ?? throw new KeyNotFoundException(ValidationMessages.ProjectNotFound);

            if (requestDto.TaxYearType == TaxYearType.CustomStartMonth)
            {
                if (!requestDto.TaxYearStartMonth.HasValue || requestDto.TaxYearStartMonth.Value is < 1 or > 12)
                    return AppResponse<ProjectTaxYearSettingsResponseDTO>.Error(nameof(requestDto.TaxYearStartMonth), ValidationMessages.InvalidTaxYearStartMonth);

                var startDay = requestDto.TaxYearStartDay ?? 1;
                var maxDaysInMonth = DateTime.DaysInMonth(2001, requestDto.TaxYearStartMonth.Value);
                if (startDay is < 1 or > 31 || startDay > maxDaysInMonth)
                    return AppResponse<ProjectTaxYearSettingsResponseDTO>.Error(nameof(requestDto.TaxYearStartDay), ValidationMessages.InvalidTaxYearStartDay);

                project.SetTaxYearRule(
                    taxYearType: requestDto.TaxYearType,
                    taxYearStartMonth: requestDto.TaxYearStartMonth,
                    taxYearStartDay: startDay,
                    taxYearLabeling: requestDto.TaxYearLabeling ?? TaxYearLabeling.ByStartYear);
            }
            else
            {
                project.SetTaxYearRule(TaxYearType.CalendarYear);
            }

            var saveProject = this.unitOfWork.ProjectRepository.InsertOrUpdate(project);
            if (saveProject.Failed)
                return AppResponse<ProjectTaxYearSettingsResponseDTO>.Error(saveProject.Messages);

            await this.unitOfWork.CommitAsync();

            return AppResponse<ProjectTaxYearSettingsResponseDTO>.Success(project.ToTaxYearSettingsDTO());
        }

        public async Task<AppResponse<ProjectTaxYearSettingsResponseDTO>> GetTaxYearSettingsAsync(Guid projectId)
        {
            if (projectId == Guid.Empty)
                return AppResponse<ProjectTaxYearSettingsResponseDTO>.Error(nameof(projectId), ValidationMessages.InvalidProjectId);

            var project = await this.unitOfWork.ProjectRepository
                .NoTrackable()
                .FirstOrDefaultAsync(p => p.Id == projectId) ?? throw new KeyNotFoundException(ValidationMessages.ProjectNotFound);

            return AppResponse<ProjectTaxYearSettingsResponseDTO>.Success(project.ToTaxYearSettingsDTO());
        }

        public async Task<AppResponse<ICollection<TaxYearPeriodResponseDTO>>> GetTaxYearsAsync(Guid projectId)
        {
            var projectResponse = await GetProjectAsync(projectId, trackable: false, requireConfiguredTaxYear: true);
            if (projectResponse.Failed)
                return AppResponse<ICollection<TaxYearPeriodResponseDTO>>.Error(projectResponse.Messages);

            var project = projectResponse.Data;

            var expenseDates = await this.unitOfWork.ProjectRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Where(p => p.Id == projectId)
                .SelectMany(p => p.Categories.SelectMany(c => c.Expenses.Select(e => e.Date)))
                .ToListAsync();

            var currentPeriod = TaxYearCalculator.GetPeriod(project, DateOnly.FromDateTime(DateTime.UtcNow.Date));

            if (expenseDates.Count == 0)
                return AppResponse<ICollection<TaxYearPeriodResponseDTO>>.Success([currentPeriod.ToDTO()]);

            var startDate = expenseDates.Min();
            var endDate = expenseDates.Max();

            if (currentPeriod.StartDate < startDate)
                startDate = currentPeriod.StartDate;

            if (currentPeriod.StartDate > endDate)
                endDate = currentPeriod.StartDate;

            var periods = TaxYearCalculator
                .GetPeriods(project, startDate, endDate)
                .OrderBy(period => period.StartDate)
                .ToDTO();

            return AppResponse<ICollection<TaxYearPeriodResponseDTO>>.Success(periods);
        }

        public async Task<AppResponse<ICollection<DeductibleGroupResponseDTO>>> GetDeductibleGroupsAsync(Guid projectId, string taxYearId)
        {
            var projectResponse = await GetProjectAsync(projectId, trackable: false, requireConfiguredTaxYear: true);
            if (projectResponse.Failed)
                return AppResponse<ICollection<DeductibleGroupResponseDTO>>.Error(projectResponse.Messages);

            var taxYearValidation = ValidateTaxYearId(projectResponse.Data, taxYearId);
            if (taxYearValidation.Failed)
                return AppResponse<ICollection<DeductibleGroupResponseDTO>>.Error(taxYearValidation.Messages);

            var normalizedTaxYearId = taxYearValidation.Data.TaxYearId;

            var groups = await this.unitOfWork.DeductibleGroupRepository
                .NoTrackable()
                .Where(g => g.ProjectId == projectId && g.TaxYearId == normalizedTaxYearId)
                .OrderBy(g => g.Name)
                .ToListAsync();

            return AppResponse<ICollection<DeductibleGroupResponseDTO>>.Success(groups.ToDTO());
        }

        public async Task<AppResponse<DeductibleGroupResponseDTO>> CreateDeductibleGroupAsync(Guid projectId, string taxYearId, DeductibleGroupRequestDTO requestDto)
        {
            if (requestDto == null)
                return AppResponse<DeductibleGroupResponseDTO>.Error(nameof(requestDto), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(requestDto)));

            var projectResponse = await GetProjectAsync(projectId, trackable: false, requireConfiguredTaxYear: true);
            if (projectResponse.Failed)
                return AppResponse<DeductibleGroupResponseDTO>.Error(projectResponse.Messages);

            var taxYearValidation = ValidateTaxYearId(projectResponse.Data, taxYearId);
            if (taxYearValidation.Failed)
                return AppResponse<DeductibleGroupResponseDTO>.Error(taxYearValidation.Messages);

            var normalizedTaxYearId = taxYearValidation.Data.TaxYearId;
            var groupName = requestDto.Name?.Trim();

            if (string.IsNullOrWhiteSpace(groupName))
                return AppResponse<DeductibleGroupResponseDTO>.Error(nameof(requestDto.Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(requestDto.Name)));

            var existingGroup = await this.unitOfWork.DeductibleGroupRepository
                .NoTrackable()
                .FirstOrDefaultAsync(g => g.ProjectId == projectId && g.TaxYearId == normalizedTaxYearId && g.Name == groupName);

            if (existingGroup != null)
                return AppResponse<DeductibleGroupResponseDTO>.Success(existingGroup.ToDTO());

            var newGroup = new DeductibleGroup(projectId: projectId, taxYearId: normalizedTaxYearId, name: groupName);
            var saveGroup = this.unitOfWork.DeductibleGroupRepository.InsertOrUpdate(newGroup);
            if (saveGroup.Failed)
                return AppResponse<DeductibleGroupResponseDTO>.Error(saveGroup.Messages);

            await this.unitOfWork.CommitAsync();

            return AppResponse<DeductibleGroupResponseDTO>.Success(newGroup.ToDTO());
        }

        public async Task<AppResponse<DeductibleGroupResponseDTO>> UpdateDeductibleGroupAsync(Guid projectId, string taxYearId, Guid groupId, DeductibleGroupRequestDTO requestDto)
        {
            if (groupId == Guid.Empty)
                return AppResponse<DeductibleGroupResponseDTO>.Error(nameof(groupId), ValidationMessages.DeductibleGroupNotFound);

            if (requestDto == null)
                return AppResponse<DeductibleGroupResponseDTO>.Error(nameof(requestDto), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(requestDto)));

            var projectResponse = await GetProjectAsync(projectId, trackable: false, requireConfiguredTaxYear: true);
            if (projectResponse.Failed)
                return AppResponse<DeductibleGroupResponseDTO>.Error(projectResponse.Messages);

            var taxYearValidation = ValidateTaxYearId(projectResponse.Data, taxYearId);
            if (taxYearValidation.Failed)
                return AppResponse<DeductibleGroupResponseDTO>.Error(taxYearValidation.Messages);

            var normalizedTaxYearId = taxYearValidation.Data.TaxYearId;
            var groupName = requestDto.Name?.Trim();

            if (string.IsNullOrWhiteSpace(groupName))
                return AppResponse<DeductibleGroupResponseDTO>.Error(nameof(requestDto.Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(requestDto.Name)));

            var existingGroup = await this.unitOfWork.DeductibleGroupRepository
                .Trackable()
                .FirstOrDefaultAsync(g => g.ProjectId == projectId && g.TaxYearId == normalizedTaxYearId && g.Id == groupId)
                ?? throw new KeyNotFoundException(ValidationMessages.DeductibleGroupNotFound);

            existingGroup.SetName(groupName);

            var saveGroup = this.unitOfWork.DeductibleGroupRepository.InsertOrUpdate(existingGroup);
            if (saveGroup.Failed)
                return AppResponse<DeductibleGroupResponseDTO>.Error(saveGroup.Messages);

            await this.unitOfWork.CommitAsync();

            return AppResponse<DeductibleGroupResponseDTO>.Success(existingGroup.ToDTO());
        }

        public async Task<AppResponse> DeleteDeductibleGroupAsync(Guid projectId, string taxYearId, Guid groupId)
        {
            if (groupId == Guid.Empty)
                return AppResponse.Error(nameof(groupId), ValidationMessages.DeductibleGroupNotFound);

            var projectResponse = await GetProjectAsync(projectId, trackable: false, requireConfiguredTaxYear: true);
            if (projectResponse.Failed)
                return AppResponse.Error(projectResponse.Messages);

            var taxYearValidation = ValidateTaxYearId(projectResponse.Data, taxYearId);
            if (taxYearValidation.Failed)
                return AppResponse.Error(taxYearValidation.Messages);

            var normalizedTaxYearId = taxYearValidation.Data.TaxYearId;

            var group = await this.unitOfWork.DeductibleGroupRepository
                .Trackable()
                .Include(g => g.GroupExpenses)
                .FirstOrDefaultAsync(g => g.ProjectId == projectId && g.TaxYearId == normalizedTaxYearId && g.Id == groupId)
                ?? throw new KeyNotFoundException(ValidationMessages.DeductibleGroupNotFound);

            foreach (var assignment in group.GroupExpenses.ToList())
                this.unitOfWork.DeductibleGroupExpenseRepository.Delete(assignment);

            this.unitOfWork.DeductibleGroupRepository.Delete(group);
            await this.unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse<ICollection<DeductibleGroupExpenseResponseDTO>>> GetGroupExpensesAsync(Guid projectId, string taxYearId, Guid groupId)
        {
            if (groupId == Guid.Empty)
                return AppResponse<ICollection<DeductibleGroupExpenseResponseDTO>>.Error(nameof(groupId), ValidationMessages.DeductibleGroupNotFound);

            var projectResponse = await GetProjectAsync(projectId, trackable: false, requireConfiguredTaxYear: true);
            if (projectResponse.Failed)
                return AppResponse<ICollection<DeductibleGroupExpenseResponseDTO>>.Error(projectResponse.Messages);

            var taxYearValidation = ValidateTaxYearId(projectResponse.Data, taxYearId);
            if (taxYearValidation.Failed)
                return AppResponse<ICollection<DeductibleGroupExpenseResponseDTO>>.Error(taxYearValidation.Messages);

            var normalizedTaxYearId = taxYearValidation.Data.TaxYearId;

            var groupExists = await this.unitOfWork.DeductibleGroupRepository
                .NoTrackable()
                .AnyAsync(g => g.ProjectId == projectId && g.TaxYearId == normalizedTaxYearId && g.Id == groupId);

            if (!groupExists)
                throw new KeyNotFoundException(ValidationMessages.DeductibleGroupNotFound);

            var assignments = await this.unitOfWork.DeductibleGroupExpenseRepository
                .NoTrackable()
                .Where(assignment => assignment.GroupId == groupId)
                .Include(assignment => assignment.Expense)
                .Include(assignment => assignment.ExpenseItem)
                .ToListAsync();

            var groupedExpenses = assignments
                .OrderByDescending(assignment => assignment.ExpenseItem?.Date ?? assignment.Expense?.Date ?? DateOnly.MinValue)
                .ThenBy(assignment => assignment.ExpenseItem?.Name ?? assignment.Expense?.Name ?? string.Empty)
                .ToDeductibleGroupExpenseDTO();

            return AppResponse<ICollection<DeductibleGroupExpenseResponseDTO>>.Success(groupedExpenses);
        }

        public async Task<AppResponse> AssignExpenseToGroupAsync(Guid projectId, string taxYearId, Guid groupId, Guid? expenseId, Guid? expenseItemId)
        {
            if (groupId == Guid.Empty)
                return AppResponse.Error(nameof(groupId), ValidationMessages.DeductibleGroupNotFound);

            if (expenseId.HasValue && expenseId.Value == Guid.Empty)
                return AppResponse.Error(nameof(expenseId), ValidationMessages.InvalidExpenseId);

            if (expenseItemId.HasValue && expenseItemId.Value == Guid.Empty)
                return AppResponse.Error(nameof(expenseItemId), ValidationMessages.InvalidExpenseItemId);

            var hasExpenseId = expenseId.HasValue && expenseId.Value != Guid.Empty;
            var hasExpenseItemId = expenseItemId.HasValue && expenseItemId.Value != Guid.Empty;
            if (hasExpenseId == hasExpenseItemId)
            {
                return AppResponse.Error([
                    new AppMessage(nameof(expenseId), ValidationMessages.InvalidExpenseId),
                    new AppMessage(nameof(expenseItemId), ValidationMessages.InvalidExpenseItemId)
                ]);
            }

            var projectResponse = await GetProjectAsync(projectId, trackable: false, requireConfiguredTaxYear: true);
            if (projectResponse.Failed)
                return AppResponse.Error(projectResponse.Messages);

            var project = projectResponse.Data;

            var taxYearValidation = ValidateTaxYearId(project, taxYearId);
            if (taxYearValidation.Failed)
                return AppResponse.Error(taxYearValidation.Messages);

            var normalizedTaxYearId = taxYearValidation.Data.TaxYearId;

            var groupExists = await this.unitOfWork.DeductibleGroupRepository
                .NoTrackable()
                .AnyAsync(g => g.ProjectId == projectId && g.TaxYearId == normalizedTaxYearId && g.Id == groupId);

            if (!groupExists)
                throw new KeyNotFoundException(ValidationMessages.DeductibleGroupNotFound);

            if (hasExpenseId)
            {
                var effectiveExpenseId = expenseId.Value;
                var expense = await this.unitOfWork.ProjectRepository
                    .NoTrackable()
                    .IgnoreQueryFilters()
                    .Where(p => p.Id == projectId)
                    .SelectMany(p => p.Categories.SelectMany(c => c.Expenses))
                    .FirstOrDefaultAsync(e => e.Id == effectiveExpenseId);

                if (expense == null)
                    return AppResponse.Error(nameof(expenseId), ValidationMessages.ExpenseNotInProject);

                if (!expense.IsDeductible)
                    return AppResponse.Error(nameof(expenseId), ValidationMessages.ExpenseMustBeDeductible);

                var expenseTaxYearId = TaxYearCalculator.GetPeriod(project, expense.Date).TaxYearId;
                if (expenseTaxYearId != normalizedTaxYearId)
                    return AppResponse.Error(nameof(expenseId), ValidationMessages.ExpenseTaxYearMismatch);

                var alreadyAssigned = await this.unitOfWork.DeductibleGroupExpenseRepository
                    .NoTrackable()
                    .AnyAsync(a => a.GroupId == groupId && a.ExpenseId == effectiveExpenseId && a.ExpenseItemId == null);

                if (alreadyAssigned)
                    return AppResponse.Success();

                var assignment = new DeductibleGroupExpense(groupId, effectiveExpenseId, null);
                var saveAssignment = this.unitOfWork.DeductibleGroupExpenseRepository.InsertOrUpdate(assignment);
                if (saveAssignment.Failed)
                    return AppResponse.Error(saveAssignment.Messages);

                await this.unitOfWork.CommitAsync();
                return AppResponse.Success();
            }

            var effectiveExpenseItemId = expenseItemId.Value;
            var expenseItem = await this.unitOfWork.ProjectRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Where(p => p.Id == projectId)
                .SelectMany(p => p.Categories.SelectMany(c => c.Expenses.SelectMany(e => e.Items)))
                .FirstOrDefaultAsync(item => item.Id == effectiveExpenseItemId);

            if (expenseItem == null)
                return AppResponse.Error(nameof(expenseItemId), ValidationMessages.ExpenseItemNotFound);

            if (!expenseItem.IsDeductible)
                return AppResponse.Error(nameof(expenseItemId), ValidationMessages.ExpenseMustBeDeductible);

            var expenseItemTaxYearId = TaxYearCalculator.GetPeriod(project, expenseItem.Date).TaxYearId;
            if (expenseItemTaxYearId != normalizedTaxYearId)
                return AppResponse.Error(nameof(expenseItemId), ValidationMessages.ExpenseTaxYearMismatch);

            var itemAlreadyAssigned = await this.unitOfWork.DeductibleGroupExpenseRepository
                .NoTrackable()
                .AnyAsync(a => a.GroupId == groupId && a.ExpenseItemId == effectiveExpenseItemId && a.ExpenseId == null);

            if (itemAlreadyAssigned)
                return AppResponse.Success();

            var itemAssignment = new DeductibleGroupExpense(groupId, null, effectiveExpenseItemId);
            var saveItemAssignment = this.unitOfWork.DeductibleGroupExpenseRepository.InsertOrUpdate(itemAssignment);
            if (saveItemAssignment.Failed)
                return AppResponse.Error(saveItemAssignment.Messages);

            await this.unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse> RemoveExpenseFromGroupAsync(Guid projectId, string taxYearId, Guid groupId, Guid? expenseId, Guid? expenseItemId)
        {
            if (groupId == Guid.Empty)
                return AppResponse.Error(nameof(groupId), ValidationMessages.DeductibleGroupNotFound);

            if (expenseId.HasValue && expenseId.Value == Guid.Empty)
                return AppResponse.Error(nameof(expenseId), ValidationMessages.InvalidExpenseId);

            if (expenseItemId.HasValue && expenseItemId.Value == Guid.Empty)
                return AppResponse.Error(nameof(expenseItemId), ValidationMessages.InvalidExpenseItemId);

            var hasExpenseId = expenseId.HasValue && expenseId.Value != Guid.Empty;
            var hasExpenseItemId = expenseItemId.HasValue && expenseItemId.Value != Guid.Empty;
            if (hasExpenseId == hasExpenseItemId)
            {
                return AppResponse.Error([
                    new AppMessage(nameof(expenseId), ValidationMessages.InvalidExpenseId),
                    new AppMessage(nameof(expenseItemId), ValidationMessages.InvalidExpenseItemId)
                ]);
            }

            var projectResponse = await GetProjectAsync(projectId, trackable: false, requireConfiguredTaxYear: true);
            if (projectResponse.Failed)
                return AppResponse.Error(projectResponse.Messages);

            var taxYearValidation = ValidateTaxYearId(projectResponse.Data, taxYearId);
            if (taxYearValidation.Failed)
                return AppResponse.Error(taxYearValidation.Messages);

            var normalizedTaxYearId = taxYearValidation.Data.TaxYearId;

            var groupExists = await this.unitOfWork.DeductibleGroupRepository
                .NoTrackable()
                .AnyAsync(g => g.ProjectId == projectId && g.TaxYearId == normalizedTaxYearId && g.Id == groupId);

            if (!groupExists)
                throw new KeyNotFoundException(ValidationMessages.DeductibleGroupNotFound);

            var assignment = await this.unitOfWork.DeductibleGroupExpenseRepository
                .Trackable()
                .FirstOrDefaultAsync(a => a.GroupId == groupId
                    && a.ExpenseId == (hasExpenseId ? expenseId : null)
                    && a.ExpenseItemId == (hasExpenseItemId ? expenseItemId : null));

            if (assignment == null)
                return AppResponse.Success();

            this.unitOfWork.DeductibleGroupExpenseRepository.Delete(assignment);
            await this.unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse<DeductibleGroupTotalsResponseDTO>> GetTotalsAsync(Guid projectId, string taxYearId)
        {
            var projectResponse = await GetProjectAsync(projectId, trackable: false, requireConfiguredTaxYear: true);
            if (projectResponse.Failed)
                return AppResponse<DeductibleGroupTotalsResponseDTO>.Error(projectResponse.Messages);

            var taxYearValidation = ValidateTaxYearId(projectResponse.Data, taxYearId);
            if (taxYearValidation.Failed)
                return AppResponse<DeductibleGroupTotalsResponseDTO>.Error(taxYearValidation.Messages);

            var normalizedTaxYearId = taxYearValidation.Data.TaxYearId;

            var groups = await this.unitOfWork.DeductibleGroupRepository
                .NoTrackable()
                .Where(g => g.ProjectId == projectId && g.TaxYearId == normalizedTaxYearId)
                .Include(g => g.GroupExpenses)
                    .ThenInclude(assignment => assignment.Expense)
                .Include(g => g.GroupExpenses)
                    .ThenInclude(assignment => assignment.ExpenseItem)
                .OrderBy(g => g.Name)
                .ToListAsync();

            var groupTotals = groups
                .Select(group => new DeductibleGroupTotalResponseDTO
                {
                    GroupId = group.Id,
                    Name = group.Name,
                    ExpenseCount = group.GroupExpenses.Count,
                    TotalAmount = group.GroupExpenses.Sum(assignment => assignment.Expense?.Amount ?? assignment.ExpenseItem?.Amount ?? 0m)
                })
                .ToList();

            var response = new DeductibleGroupTotalsResponseDTO
            {
                TaxYearId = normalizedTaxYearId,
                Groups = groupTotals,
                TotalAmount = groupTotals.Sum(group => group.TotalAmount)
            };

            return AppResponse<DeductibleGroupTotalsResponseDTO>.Success(response);
        }

        private async Task<AppResponse<Project>> GetProjectAsync(Guid projectId, bool trackable, bool requireConfiguredTaxYear)
        {
            if (projectId == Guid.Empty)
                return AppResponse<Project>.Error(nameof(projectId), ValidationMessages.InvalidProjectId);

            var query = trackable
                ? this.unitOfWork.ProjectRepository.Trackable()
                : this.unitOfWork.ProjectRepository.NoTrackable();

            var project = await query.FirstOrDefaultAsync(p => p.Id == projectId);
            if (project == null)
                throw new KeyNotFoundException(ValidationMessages.ProjectNotFound);

            if (requireConfiguredTaxYear && !TaxYearCalculator.IsConfigured(project))
                return AppResponse<Project>.Error(nameof(ValidationMessages.TaxYearNotConfigured), ValidationMessages.TaxYearNotConfigured);

            return AppResponse<Project>.Success(project);
        }

        private static AppResponse<TaxYearPeriod> ValidateTaxYearId(Project project, string taxYearId)
        {
            if (!TaxYearCalculator.TryParseTaxYearId(project, taxYearId?.Trim(), out var period))
                return AppResponse<TaxYearPeriod>.Error(nameof(taxYearId), ValidationMessages.InvalidTaxYearId);

            return AppResponse<TaxYearPeriod>.Success(period);
        }
    }
}
