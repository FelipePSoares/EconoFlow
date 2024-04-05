﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Infrastructure;

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
            return unitOfWork.UserProjectRepository.NoTrackable().Where(up => up.User.Id == userId).Select(p => p.Project).ToList();
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
            if (id == null || id == Guid.Empty)
                throw new ArgumentNullException("The id is not valid");

            var project = unitOfWork.ProjectRepository.Trackable().FirstOrDefault(product => product.Id == id);

            if (project == null)
                return;

            unitOfWork.ProjectRepository.Delete(project);
            await unitOfWork.CommitAsync();
        }
    }
}
