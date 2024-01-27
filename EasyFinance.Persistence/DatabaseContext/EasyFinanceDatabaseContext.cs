using EasyFinance.Domain.Models.FinancialProject;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Persistence.DatabaseContext
{
    public class EasyFinanceDatabaseContext: IdentityDbContext
    {
        public EasyFinanceDatabaseContext(DbContextOptions<EasyFinanceDatabaseContext> options): base (options)
        {
        }

        public DbSet<Project> Projects { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(EasyFinanceDatabaseContext).Assembly);
            base.OnModelCreating(modelBuilder);
        }
    }
}
