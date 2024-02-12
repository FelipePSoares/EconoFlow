using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Persistence.DatabaseContext;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Persistence.Repositories
{
    public class UnitOfWork : IUnitOfWork, IDisposable
    {
        private bool disposed = false;
        private readonly EasyFinanceDatabaseContext context;
        private readonly Lazy<IGenericRepository<Project>> projectRepository;

        public UnitOfWork(EasyFinanceDatabaseContext dbContext)
        {
            this.context = dbContext;
            this.projectRepository = new Lazy<IGenericRepository<Project>>(() => new GenericRepository<Project>(this.context));
        }

        public IGenericRepository<Project> ProjectRepository => this.projectRepository.Value;

        public async Task CommitAsync()
        {
            var currentDateTime = DateTime.Now;
            var entries = this.context.ChangeTracker.Entries();

            // get a list of all Modified entries which implement the BaseEntity
            var updatedEntries = entries.Where(e => e.Entity is BaseEntity)
                    .Where(e => e.State == EntityState.Modified)
                    .ToList();

            updatedEntries.ForEach(e =>
            {

                ((BaseEntity)e.Entity).ModifiedAt = currentDateTime;
            });

            // get a list of all Added entries which implement the BaseEntity
            var addedEntries = entries.Where(e => e.Entity is BaseEntity)
                    .Where(e => e.State == EntityState.Added)
                    .ToList();

            addedEntries.ForEach(e =>
            {
                ((BaseEntity)e.Entity).CreatedDate = currentDateTime;
                ((BaseEntity)e.Entity).ModifiedAt = currentDateTime;
            });

            await this.context.SaveChangesAsync();
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!this.disposed)
            {
                if (disposing)
                {
                    this.context.Dispose();
                }
            }
            this.disposed = true;
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }
    }
}
