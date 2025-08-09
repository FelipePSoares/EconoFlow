﻿using System.Collections.Generic;
using System;
using System.Threading.Tasks;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using Microsoft.EntityFrameworkCore;
using EasyFinance.Application.Features.SupportService;
using EasyFinance.Domain.Support;

namespace EasyFinance.Application.Contracts.Persistence
{
    public interface IUnitOfWork
    {
        IGenericRepository<Project> ProjectRepository { get; }
        IGenericRepository<UserProject> UserProjectRepository { get; }
        IGenericRepository<Income> IncomeRepository { get; }
        IGenericRepository<Category> CategoryRepository { get; }
        IGenericRepository<Expense> ExpenseRepository { get; }
        IGenericRepository<ExpenseItem> ExpenseItemRepository { get; }
        IGenericRepository<ContactUs> ContactUsRepository { get; }

        Task CommitAsync();

        ICollection<Guid> GetAffectedUsers(params EntityState[] entityStates);
    }
}
