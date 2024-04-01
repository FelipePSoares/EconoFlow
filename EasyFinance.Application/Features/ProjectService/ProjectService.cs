using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Application.Features.ProjectService
{
    public class ProjectService
    {
        private readonly IUnitOfWork _unitOfWork;

        public ProjectService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public ICollection<Project> GetAllAsync()
        {
            return _unitOfWork.ProjectRepository.NoTrackable().ToList();
        }

        public Project GetById(Guid id)
        {
            if (id == null || id == Guid.Empty)
                throw new ArgumentNullException("The Project id cannot be null or empty");

            return _unitOfWork.ProjectRepository.NoTrackable().FirstOrDefault(product => product.Id == id);
        }

        public async Task<Project> CreateAsync(Project project)
        {
            if (project == null)
                throw new ArgumentNullException("The Project you are trying to save is not valid");

            _unitOfWork.ProjectRepository.InsertOrUpdate(project);
            await _unitOfWork.CommitAsync();

            return project;
        }

        public async Task<Project> UpdateAsync(Project project)
        {
            if (project == null)
                throw new ArgumentNullException("The project you are trying to update is not valid");

            _unitOfWork.ProjectRepository.InsertOrUpdate(project);
            await _unitOfWork.CommitAsync();

            return project;
        }

        public async Task DeleteAsync(Guid id)
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
