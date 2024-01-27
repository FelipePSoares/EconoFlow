using System.Linq;
using EasyFinance.Domain.Models;

namespace EasyFinance.Application.Contracts.Persistence
{
    public interface IGenericRepository<T> where T : BaseEntity
    {
        IQueryable<T> Trackable();
        IQueryable<T> NoTrackable();
        T InsertOrUpdate(T entity);
        T Delete(T entity);
    }
}
