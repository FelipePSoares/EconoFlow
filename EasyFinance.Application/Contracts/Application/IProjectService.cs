using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Application.Contracts.Application
{
    public interface IProjectService
    {
        ICollection<Project> GetAll(Guid userId);

        Project GetById(Guid userId, Guid id);

        Task<Project> CreateAsync(User user, Project project);

        Task<Project> UpdateAsync(Guid userId, Project project);

        Task DeleteAsync(Guid userId, Guid id);
    }
}
