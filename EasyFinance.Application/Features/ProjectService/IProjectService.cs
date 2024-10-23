using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Application.Features.ProjectService
{
    public interface IProjectService
    {
        ICollection<Project> GetAll(Guid userId);

        Project GetById(Guid id);

        Task<Project> CreateAsync(User user, Project project);

        Task<Project> UpdateAsync(Project project);

        Task DeleteAsync(Guid id);

        Task<ICollection<Expense>> CopyBudgetFromPreviousMonthAsync(User user, Guid id, DateTime currentDate);
    }
}
