using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.ProjectService
{
    public class ProjectService : IProjectService
    {
        private readonly IUnitOfWork unitOfWork;

        public ProjectService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public ICollection<Project> GetAll(Guid userId)
        {
            return unitOfWork.UserProjectRepository.NoTrackable().Where(up => up.User.Id == userId && !up.Project.Archive).Select(p => p.Project).ToList();
        }

        public Project GetById(Guid id)
        {
            return unitOfWork.ProjectRepository.Trackable().FirstOrDefault(up => up.Id == id);
        }

        public async Task<Project> CreateAsync(User user, Project project)
        {
            if (project == default)
                throw new ArgumentNullException(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(project)));

            if (user == default)
                throw new ArgumentNullException(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

            var projectExistent = await unitOfWork.ProjectRepository.Trackable().FirstOrDefaultAsync(p => p.Name == project.Name && !p.Archive);

            if (projectExistent != default)
                return projectExistent;

            unitOfWork.ProjectRepository.InsertOrUpdate(project);
            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProject(user, project, Role.Admin));
            await unitOfWork.CommitAsync();

            return project;
        }

        public async Task<Project> UpdateAsync(Project project)
        {
            if (project == default)
                throw new ArgumentNullException(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(project)));

            unitOfWork.ProjectRepository.InsertOrUpdate(project);
            await unitOfWork.CommitAsync();

            return project;
        }

        public async Task DeleteAsync(Guid id)
        {
            if (id == Guid.Empty)
                throw new ArgumentNullException("The id is not valid");

            var project = unitOfWork.ProjectRepository.Trackable().FirstOrDefault(product => product.Id == id);

            if (project == null)
                return;

            project.SetArchive();

            unitOfWork.ProjectRepository.InsertOrUpdate(project);
            await unitOfWork.CommitAsync();
        }

        public async Task<ICollection<Expense>> CopyBudgetFromPreviousMonthAsync(User user, Guid id, DateTime currentDate)
        {
            if (id == Guid.Empty)
                throw new ArgumentNullException($"The {nameof(id)} is not valid");

            if (currentDate == DateTime.MinValue)
                throw new ArgumentNullException($"The {nameof(currentDate)} is not valid");

            var project = await unitOfWork.ProjectRepository.Trackable()
                .Include(p => p.Categories.Where(c => !c.IsArchived))
                    .ThenInclude(c => c.Expenses)
                .FirstOrDefaultAsync(up => up.Id == id);

            if (project.Categories.Any(c => c.Expenses.Any(e => e.Date.Month == currentDate.Month && e.Date.Year == currentDate.Year && e.Budget > 0)))
                throw new ValidationException("General", ValidationMessages.CantImportBudgetBecauseAlreadyExists);

            var newExpenses = project.Categories.SelectMany(c => c.CopyBudgetToCurrentMonth(user, currentDate)).ToList();

            await unitOfWork.CommitAsync();

            return newExpenses;
        }
    }
}
