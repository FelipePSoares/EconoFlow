using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.ProjectService
{
    public class ProjectService : IProjectService
    {
        private readonly IUnitOfWork unitOfWork;
        private readonly UserManager<User> userManager;

        public ProjectService(IUnitOfWork unitOfWork, UserManager<User> userManager)
        {
            this.unitOfWork = unitOfWork;
            this.userManager = userManager;
        }

        public AppResponse<ICollection<UserProjectResponseDTO>> GetAll(Guid userId)
        {
            var result = unitOfWork.UserProjectRepository.NoTrackable().Include(up => up.Project).Include(up => up.User)
                .Where(up => up.User.Id == userId)
                .ToDTO()
                .ToList();

            return AppResponse<ICollection<UserProjectResponseDTO>>.Success(result);
        }

        public AppResponse<UserProjectResponseDTO> GetById(Guid userId, Guid projectId)
        {
            var result = unitOfWork.UserProjectRepository.NoTrackable()
                .Include(up => up.Project)
                .Include(up => up.User)
                .ToDTO()
                .FirstOrDefault(up => up.Project.Id == projectId && up.UserId == userId);

            return AppResponse<UserProjectResponseDTO>.Success(result);
        }

        public async Task<AppResponse<UserProjectResponseDTO>> CreateAsync(User user, Project project, bool isFirstProject)
        {
            if (project == default)
                return AppResponse<UserProjectResponseDTO>.Error(code: nameof(project), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(project)));

            if (user == default)
                return AppResponse<UserProjectResponseDTO>.Error(code: nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

            if (project.Type == ProjectTypes.Company && user.SubscriptionLevel < SubscriptionLevels.Enterprise)
                return AppResponse<UserProjectResponseDTO>.Error(description: ValidationMessages.CompanyProjectNotAllowed);

            var savedProject = unitOfWork.ProjectRepository.InsertOrUpdate(project);
            if (savedProject.Failed)
                return AppResponse<UserProjectResponseDTO>.Error(savedProject.Messages);

            var userProject = new UserProject(user, project, Role.Admin);
            userProject.SetAccepted();

            var savedUserProject = unitOfWork.UserProjectRepository.InsertOrUpdate(userProject);
            if (savedUserProject.Failed)
                return AppResponse<UserProjectResponseDTO>.Error(savedUserProject.Messages);

            await unitOfWork.CommitAsync();

            if (isFirstProject)
            {
                user.SetDefaultProject(project.Id);
                await userManager.UpdateAsync(user);
            }

            return AppResponse<UserProjectResponseDTO>.Success(savedUserProject.Data.ToDTO());
        }

        public async Task<AppResponse<ProjectResponseDTO>> UpdateAsync(Project project)
        {
            if (project == default)
                return AppResponse<ProjectResponseDTO>.Error(code: nameof(project), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(project)));

            var savedProject = unitOfWork.ProjectRepository.InsertOrUpdate(project);
            if (savedProject.Failed)
                return AppResponse<ProjectResponseDTO>.Error(savedProject.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse<ProjectResponseDTO>.Success(project.ToDTO());
        }

        public async Task<AppResponse<ProjectResponseDTO>> UpdateAsync(Guid projectId, JsonPatchDocument<ProjectRequestDTO> projectDto)
        {
            var existingProject = unitOfWork.ProjectRepository
                .Trackable()
                .FirstOrDefault(up => up.Id == projectId) ?? throw new KeyNotFoundException(ValidationMessages.ProjectNotFound);

            var dto = existingProject.ToRequestDTO();

            projectDto.ApplyTo(dto);

            var result = dto.FromDTO(existingProject);

            var userProject = await unitOfWork.UserProjectRepository.NoTrackable()
                .FirstOrDefaultAsync(up => up.Project.Id == projectId && up.User.SubscriptionLevel >= SubscriptionLevels.Enterprise);

            if (result.Type == ProjectTypes.Company && userProject == default)
                return AppResponse<ProjectResponseDTO>.Error(description: ValidationMessages.CompanyProjectNotAllowed);

            await UpdateAsync(result);

            return AppResponse<ProjectResponseDTO>.Success(result.ToDTO());
        }

        public async Task<AppResponse> ArchiveAsync(Guid id)
        {
            if (id == Guid.Empty)
                return AppResponse.Error(code: nameof(id), description: ValidationMessages.InvalidProjectId);

            var project = unitOfWork.ProjectRepository
                .Trackable()
                .FirstOrDefault(product => product.Id == id) ?? throw new KeyNotFoundException(ValidationMessages.ProjectNotFound);

            project.SetArchive();

            var savedProject = unitOfWork.ProjectRepository.InsertOrUpdate(project);
            if (savedProject.Failed)
                return AppResponse<ProjectResponseDTO>.Error(savedProject.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse<ICollection<ExpenseResponseDTO>>> CopyBudgetFromPreviousMonthAsync(User user, Guid id, DateTime currentDate)
        {
            if (id == Guid.Empty)
                return AppResponse<ICollection<ExpenseResponseDTO>>.Error(code: nameof(id), description: ValidationMessages.InvalidProjectId);

            if (currentDate == DateTime.MinValue)
                return AppResponse<ICollection<ExpenseResponseDTO>>.Error(code: nameof(currentDate), description: ValidationMessages.InvalidDate);

            var project = await unitOfWork.ProjectRepository.Trackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                .FirstOrDefaultAsync(up => up.Id == id);

            if (project.Categories.Any(c => c.Expenses.Any(e => e.Date.Month == currentDate.Month && e.Date.Year == currentDate.Year && e.Budget > 0)))
                return AppResponse<ICollection<ExpenseResponseDTO>>.Error(description: ValidationMessages.CantImportBudgetBecauseAlreadyExists);

            var newExpenses = project.Categories.SelectMany(c => c.CopyBudgetToCurrentMonth(user, currentDate)).ToDTO().ToList();

            await unitOfWork.CommitAsync();

            return AppResponse<ICollection<ExpenseResponseDTO>>.Success(newExpenses);
        }

        public async Task<AppResponse> DeleteOrRemoveLinkAsync(User user)
        {
            var userProjects = await unitOfWork.UserProjectRepository.Trackable()
                .Include(up => up.Project)
                    .ThenInclude(up => up.Categories)
                        .ThenInclude(up => up.Expenses)
                            .ThenInclude(up => up.Items)
                .Where(up => up.User.Id == user.Id).ToListAsync();

            var projectsToUnlink = await unitOfWork.UserProjectRepository.NoTrackable().Include(up => up.Project)
                .Where(up =>
                    userProjects.Select(x => x.Project.Id).Contains(up.Project.Id) &&
                    up.Role == Role.Admin &&
                    up.User.Id != user.Id
                )
                .Select(up => up.Project.Id)
                .Distinct()
                .ToListAsync();

            foreach (var userProject in userProjects)
            {
                if (projectsToUnlink.Contains(userProject.Project.Id))
                    unitOfWork.UserProjectRepository.Delete(userProject);
                else
                {
                    var items = userProject.Project.Categories.SelectMany(c => c.Expenses.SelectMany(e => e.Items));
                    foreach (var item in items)
                    {
                        unitOfWork.ExpenseItemRepository.Delete(item);
                    }

                    var expenses = userProject.Project.Categories.SelectMany(c => c.Expenses);
                    foreach (var expense in expenses)
                    {
                        unitOfWork.ExpenseRepository.Delete(expense);
                    }

                    var ups = unitOfWork.UserProjectRepository.Trackable().Where(up => up.Project.Id == userProject.Project.Id).ToList();

                    foreach (var up in userProjects)
                    {
                        unitOfWork.UserProjectRepository.Delete(up);
                    }

                    unitOfWork.ProjectRepository.Delete(userProject.Project);
                }
            }

            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse<IList<string>>> GetProjectsWhereUserIsSoleAdminAsync(User user){
            var userProjects = await unitOfWork.UserProjectRepository.Trackable().Include(up => up.Project)
                .Where(up => up.User.Id == user.Id && up.Role == Role.Admin)
                .ToListAsync();

            var projectsWithOthersAdmins = await unitOfWork.UserProjectRepository.NoTrackable().Include(up => up.Project)
                .Where(up =>
                    userProjects.Select(x => x.Project.Id).Contains(up.Project.Id) &&
                    up.Role == Role.Admin &&
                    up.User.Id != user.Id
                )
                .Select(up => up.Project.Id)
                .Distinct()
                .ToListAsync();

            var result = userProjects.Where(up => !projectsWithOthersAdmins.Contains(up.Project.Id)).Select(up => up.Project.Name).ToList();
            return AppResponse<IList<string>>.Success(result);
        }

        public async Task<AppResponse<ICollection<TransactionResponseDTO>>> GetLatestAsync(Guid projectId, int numberOfTransactions)
        {
            var result = new List<TransactionResponseDTO>();

            var project = await unitOfWork.ProjectRepository
                .NoTrackable()
                .Where(p => p.Id == projectId)
                .Select(p => new
                {
                    Project = p,
                    Incomes = p.Incomes.Where(i => i.Amount > 0).OrderByDescending(i => i.Date).Take(5).ToList(),
                    Categories = p.Categories.Select(c => new
                    {
                        c.Name,
                        Expenses = c.Expenses.Where(e => e.Amount > 0).OrderByDescending(e => e.Date).Take(5).Select(e => new
                        {
                            e.Name,
                            e.Date,
                            e.Amount,
                            Expense = e,
                            Items = e.Items.Where(i => i.Amount > 0).OrderByDescending(i => i.Date).Take(5).Select(i => new {
                                i.Name,
                                i.Date,
                                i.Amount
                            })
                        }).ToList()
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            result.AddRange(
                project
                .Incomes
                .OrderByDescending(i => i.Date)
                .Take(numberOfTransactions)
                .Select(income => new TransactionResponseDTO()
                {
                    Id = income.Id,
                    Amount = income.Amount,
                    Date = income.Date,
                    Name = income.Name,
                    Type = TransactionType.Income
                }));

            result.AddRange(
                project.Categories
                .SelectMany(c => c.Expenses)
                .OrderByDescending(i => i.Date)
                .Take(numberOfTransactions)
                .Select(expense => new TransactionResponseDTO()
                {
                    Name = expense.Name,
                    Date = expense.Date,
                    Amount = expense.Amount,
                    Type = TransactionType.Expense
                }));

            result.AddRange(
                project.Categories
                .SelectMany(c => c.Expenses)
                .SelectMany(e => e.Items)
                .OrderByDescending(i => i.Date)
                .Take(numberOfTransactions)
                .Select(expenseItem => new TransactionResponseDTO()
                {
                    Name = expenseItem.Name,
                    Date = expenseItem.Date,
                    Amount = expenseItem.Amount,
                    Type = TransactionType.Expense
                }));

            result = result.OrderByDescending(i => i.Date).Take(numberOfTransactions).ToList();

            return AppResponse<ICollection<TransactionResponseDTO>>.Success(result);
        }

        public async Task<AppResponse> SmartSetupAsync(User user, Guid projectId, SmartSetupRequestDTO smartRequest)
        {
            var project = await unitOfWork.ProjectRepository
                .NoTrackable()
                .Include(p => p.Incomes)
                .Include(p => p.Categories)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project.Categories.Count > 0)
                return AppResponse.Error(ValidationMessages.SmartSetupNotAvailable);
                
            var categories = smartRequest.DefaultCategories.Select(c => Category.CreateDefaultCategoryWithExpense(user, c.Name, c.Percentage, smartRequest.AnnualIncome, smartRequest.Date));

            var result = AppResponse.Success();

            foreach (var category in categories)
            {
                foreach (var expense in category.Expenses)
                {
                    var savedExpense = this.unitOfWork.ExpenseRepository.InsertOrUpdate(expense);
                    if (savedExpense.Failed)
                        result.AddErrorMessage(savedExpense.Messages);
                }

                var savedCategory = this.unitOfWork.CategoryRepository.InsertOrUpdate(category);
                if (savedCategory.Failed)
                    result.AddErrorMessage(savedCategory.Messages);

                project.Categories.Add(savedCategory.Data);
            }

            var savedProject = this.unitOfWork.ProjectRepository.InsertOrUpdate(project);
            if (savedProject.Failed)
                result.AddErrorMessage(savedProject.Messages);

            if (result.Failed)
                return result;

            await unitOfWork.CommitAsync();

            return result;            
        }
    }
}
