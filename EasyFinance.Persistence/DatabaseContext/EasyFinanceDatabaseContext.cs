﻿using EasyFinance.Domain.AccessControl;
using EasyFinance.Persistence.Mapping.AccessControl;
using EasyFinance.Persistence.Mapping.Financial;
using EasyFinance.Persistence.Mapping.FinancialProject;
using EasyFinance.Persistence.Mapping.Support;
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
            // Access Control
            modelBuilder.ApplyConfiguration(new UserConfiguration());
            modelBuilder.ApplyConfiguration(new UserProjectConfiguration());

            // Financial
            modelBuilder.ApplyConfiguration(new AttachmentConfiguration());
            modelBuilder.ApplyConfiguration(new IncomeConfiguration());
            modelBuilder.ApplyConfiguration(new ExpenseConfiguration());
            modelBuilder.ApplyConfiguration(new ExpenseItemConfiguration());
            modelBuilder.ApplyConfiguration(new CategoryConfiguration());

            // FinancialProject
            modelBuilder.ApplyConfiguration(new ProjectConfiguration());

            //Support
            modelBuilder.ApplyConfiguration(new ContactUsConfiguration());

            base.OnModelCreating(modelBuilder);
        }
    }
}
