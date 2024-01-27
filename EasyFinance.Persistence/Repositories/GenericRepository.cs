using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Persistence.Repositories
{
    public class GenericRepository<T> : IGenericRepository<T> where T : BaseEntity
    {
        private readonly DbSet<T> dbSet;

        public GenericRepository(DbContext context)
        {
            this.dbSet = context.Set<T>();
        }

        public IQueryable<T> Trackable() => this.dbSet.AsQueryable();

        public IQueryable<T> NoTrackable() => this.dbSet.AsNoTracking();

        public T InsertOrUpdate(T entity) => this.dbSet.Update(entity).Entity;

        public T Delete(T entity) => this.dbSet.Remove(entity).Entity;
    }
}
