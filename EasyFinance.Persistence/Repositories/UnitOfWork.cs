using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Persistence.DatabaseContext;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Persistence.Repositories
{
    public class UnitOfWork : IUnitOfWork, IDisposable
    {
        private bool disposed = false;
        private readonly EasyFinanceDatabaseContext context;
        private readonly Lazy<IGenericRepository<Project>> projectRepository;
        private readonly Lazy<IGenericRepository<UserProject>> userProjectRepository;
        private readonly Lazy<IGenericRepository<Income>> incomeRepository;
        private readonly Lazy<IGenericRepository<Category>> categoryRepository;
        private readonly Lazy<IGenericRepository<Expense>> expenseRepository;
        private readonly Lazy<IGenericRepository<ExpenseItem>> expenseItemRepository;

        public UnitOfWork(EasyFinanceDatabaseContext dbContext)
        {
            this.context = dbContext;
            this.projectRepository = new Lazy<IGenericRepository<Project>>(() => new GenericRepository<Project>(this.context));
            this.userProjectRepository = new Lazy<IGenericRepository<UserProject>>(() => new GenericRepository<UserProject>(this.context));
            this.incomeRepository = new Lazy<IGenericRepository<Income>>(() => new GenericRepository<Income>(this.context));
            this.categoryRepository = new Lazy<IGenericRepository<Category>>(() => new GenericRepository<Category>(this.context));
            this.expenseRepository = new Lazy<IGenericRepository<Expense>>(() => new GenericRepository<Expense>(this.context));
            this.expenseItemRepository = new Lazy<IGenericRepository<ExpenseItem>>(() => new GenericRepository<ExpenseItem>(this.context));
        }

        public IGenericRepository<Project> ProjectRepository => this.projectRepository.Value;
        public IGenericRepository<UserProject> UserProjectRepository => this.userProjectRepository.Value;
        public IGenericRepository<Income> IncomeRepository => this.incomeRepository.Value;
        public IGenericRepository<Category> CategoryRepository => this.categoryRepository.Value;
        public IGenericRepository<Expense> ExpenseRepository => this.expenseRepository.Value;
        public IGenericRepository<ExpenseItem> ExpenseItemRepository => this.expenseItemRepository.Value;

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

        public ICollection<Guid> GetAffectedUsers(params EntityState[] entityStates)
        {
            var entries = this.context.ChangeTracker.Entries();

            var updatedUsers = entries
                .Where(e => 
                    e.Entity is UserProject userProject && 
                    userProject.User != null && 
                    entityStates.Contains(e.State))
                .Select(e => ((UserProject)e.Entity).User.Id)
                .Distinct()
                .ToList();

            return updatedUsers;
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
