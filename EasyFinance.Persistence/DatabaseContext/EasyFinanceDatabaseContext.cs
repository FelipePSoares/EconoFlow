using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Persistence.Mapping;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Persistence.DatabaseContext
{
    public class EasyFinanceDatabaseContext(DbContextOptions<EasyFinanceDatabaseContext> options) :
        IdentityDbContext<User, IdentityRole<Guid>, Guid>(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(EasyFinanceDatabaseContext).Assembly);

            modelBuilder.ApplyConfiguration(new UserProjectConfiguration());

            base.OnModelCreating(modelBuilder);
        }
    }
}
