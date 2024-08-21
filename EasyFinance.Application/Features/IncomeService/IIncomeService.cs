using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.Financial;

namespace EasyFinance.Application.Features.IncomeService
{
    public interface IIncomeService
    {
        ICollection<Income> GetAll(Guid projectId);
        ICollection<Income> Get(Guid projectId, DateTime from, DateTime to);
        Income GetById(Guid incomeId);
        Task<Income> CreateAsync(User user, Guid projectId, Income income);
        Task<Income> UpdateAsync(Income income);
        Task DeleteAsync(Guid incomeId);
    }
}
