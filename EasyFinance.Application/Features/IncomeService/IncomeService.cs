using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.IncomeService
{
    public class IncomeService : IIncomeService
    {
        private readonly IUnitOfWork unitOfWork;

        public IncomeService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public ICollection<Income> GetAll(Guid projectId)
        {
            return this.unitOfWork.ProjectRepository.NoTrackable().Include(p => p.Incomes).FirstOrDefault(p => p.Id == projectId).Incomes;
        }

        public ICollection<Income> Get(Guid projectId, DateTime currentDate)
        {
            return this.unitOfWork.ProjectRepository.NoTrackable()
                .Include(p => p.Incomes.Where(i => i.Date.Year == currentDate.Year && i.Date.Month == currentDate.Month))
                .FirstOrDefault(p => p.Id == projectId).Incomes;
        }

        public Income GetById(Guid incomeId)
        {
            return this.unitOfWork.IncomeRepository.Trackable().FirstOrDefault(p => p.Id == incomeId);
        }

        public async Task<Income> CreateAsync(User user, Guid projectId, Income income)
        {
            if (income == default)
                throw new ArgumentNullException(nameof(income), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(income)));

            if (user == default)
                throw new ArgumentNullException(nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

            income.SetCreatedBy(user);

            var project = unitOfWork.ProjectRepository.Trackable().Include(p => p.Incomes).FirstOrDefault(p => p.Id == projectId);

            this.unitOfWork.IncomeRepository.InsertOrUpdate(income);
            project.Incomes.Add(income);
            this.unitOfWork.ProjectRepository.InsertOrUpdate(project);

            await unitOfWork.CommitAsync();

            return income;
        }

        public async Task<Income> UpdateAsync(Income income)
        {
            if (income == default)
                throw new ArgumentNullException(nameof(income), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(income)));

            unitOfWork.IncomeRepository.InsertOrUpdate(income);
            await unitOfWork.CommitAsync();

            return income;
        }

        public async Task DeleteAsync(Guid incomeId)
        {
            if (incomeId == Guid.Empty)
                throw new ArgumentNullException(nameof(incomeId) , "The id is not valid");

            var income = unitOfWork.IncomeRepository.Trackable().FirstOrDefault(i => i.Id == incomeId);

            if (income == null)
                return;

            unitOfWork.IncomeRepository.Delete(income);
            await unitOfWork.CommitAsync();
        }
    }
}
