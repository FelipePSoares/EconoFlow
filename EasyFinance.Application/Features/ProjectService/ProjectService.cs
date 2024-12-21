﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
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
            return unitOfWork.UserProjectRepository.NoTrackable()
                .Where(up => up.User.Id == userId && !up.Project.Archive).Select(p => p.Project).ToList();
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

        public async Task DeleteOrRemoveLinkAsync(User user)
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
        }

        public async Task<IList<string>> GetProjectsWhereUserIsSoleAdminAsync(User user){
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

            return userProjects.Where(up => !projectsWithOthersAdmins.Contains(up.Project.Id)).Select(up => up.Project.Name).ToList();
        }
    }
}
