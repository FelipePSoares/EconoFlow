using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;

namespace EasyFinance.Application.Features.IncomeService
{
    public interface IIncomeService
    {
        ICollection<Income> GetAll(Guid projectId);
        ICollection<Income> Get(Guid projectId, DateTime from, DateTime to);
        Task<ICollection<Income>> GetAsync(Guid projectId, int year);
        Income GetById(Guid incomeId);
        Task<Income> CreateAsync(User user, Guid projectId, Income income);
        Task<Income> UpdateAsync(Income income);
        Task DeleteAsync(Guid incomeId);
        Task RemoveLinkAsync(User user);
    }
}
