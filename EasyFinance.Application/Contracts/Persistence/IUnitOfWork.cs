using System.Threading.Tasks;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Application.Contracts.Persistence
{
    public interface IUnitOfWork
    {
        IGenericRepository<Project> ProjectRepository { get; }

        Task CommitAsync();
    }
}
