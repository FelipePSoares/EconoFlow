using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Application;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Application.Features.ProjectService
{
    public class ProjectService : IProjectService
    {
        private static Role[] RolesThatCanEdit = { Role.Manager, Role.Admin };

        private readonly IUnitOfWork _unitOfWork;

        public ProjectService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public ICollection<Project> GetAll(Guid userId)
        {
            return _unitOfWork.UserProjectRepository.NoTrackable().Where(up => up.User.Id == userId).Select(p => p.Project).ToList();
        }

        public Project GetById(Guid userId, Guid id)
        {
            return _unitOfWork.UserProjectRepository.NoTrackable().FirstOrDefault(up => up.User.Id == userId && up.Project.Id == id)?.Project;
        }

        public async Task<Project> CreateAsync(User user, Project project)
        {
            if (project == default)
                throw new ArgumentNullException(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(project)));

            if (user == default)
                throw new ArgumentNullException(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

            _unitOfWork.ProjectRepository.InsertOrUpdate(project);
            _unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProject(user, project, Role.Admin));
            await _unitOfWork.CommitAsync();

            return project;
        }

        public async Task<Project> UpdateAsync(Guid userId, Project project)
        {
            if (project == default)
                throw new ArgumentNullException(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(project)));

            if (userId == default)
                throw new ArgumentNullException(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(userId)));

            var userProject = _unitOfWork.UserProjectRepository.NoTrackable().FirstOrDefault(up => up.User.Id == userId && up.Project.Id == project.Id);

            if (userProject == default || !RolesThatCanEdit.Contains(userProject.Role))
                throw new ForbiddenException();

            _unitOfWork.ProjectRepository.InsertOrUpdate(project);
            await _unitOfWork.CommitAsync();

            return project;
        }

        public async Task DeleteAsync(Guid userId, Guid id)
        {
            if (id == null || id == Guid.Empty)
                throw new ArgumentNullException("The id is not valid");

            var project = _unitOfWork.ProjectRepository.Trackable().FirstOrDefault(product => product.Id == id) 
                ?? throw new InvalidOperationException("The project you are trying to delete dosen`t exist");

            _unitOfWork.ProjectRepository.Delete(project);
            await _unitOfWork.CommitAsync();
        }
    }
}
