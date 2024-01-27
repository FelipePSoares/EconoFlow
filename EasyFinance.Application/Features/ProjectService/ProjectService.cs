using AutoMapper;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs;
using EasyFinance.Domain.Models.FinancialProject;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.ProjectService
{
    public class ProjectService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IMapper _mapper;

        public ProjectService(IUnitOfWork unitOfWork, IMapper mapper)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
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

        public async Task CreateAsync(ProjectDtoApp project)
        {
            if (project == null)
                throw new ArgumentNullException("The Project you are trying to save is not valid");

            _unitOfWork.ProjectRepository.InsertOrUpdate(_mapper.Map<Project>(project));
            await _unitOfWork.CommitAsync();
        }

        public async Task UpdateAsync(ProjectDtoApp project)
        {
            if (project == null)
                throw new ArgumentNullException("The project you are trying to update is not valid");

            _unitOfWork.ProjectRepository.InsertOrUpdate(_mapper.Map<Project>(project));
            await _unitOfWork.CommitAsync();
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
