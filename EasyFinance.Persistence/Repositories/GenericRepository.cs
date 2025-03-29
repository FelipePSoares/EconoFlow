using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain;
using EasyFinance.Infrastructure.DTOs;
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

        /// <summary>
        /// Just available for integration tests
        /// </summary>
        /// <param name="entity"></param>
        /// <returns></returns>
        public T Insert(T entity)
        {
#if DEBUG
            return this.dbSet.Add(entity).Entity;
#endif
            return entity;
        }

        public AppResponse<T> InsertOrUpdate(T entity)
        {
            var validationResult = entity.Validate;

            if (validationResult.Failed)
                return AppResponse<T>.Error(validationResult.Messages);

            var result = this.dbSet.Update(entity).Entity;

            return AppResponse<T>.Success(result);
        }

        public T Delete(T entity) => this.dbSet.Remove(entity).Entity;
    }
}
