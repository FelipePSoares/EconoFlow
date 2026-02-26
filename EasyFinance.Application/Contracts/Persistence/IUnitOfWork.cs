using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Domain.Support;
using Microsoft.EntityFrameworkCore;

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
        IGenericRepository<Attachment> AttachmentRepository { get; }
        IGenericRepository<ContactUs> ContactUsRepository { get; }
        IGenericRepository<Notification> NotificationRepository { get; }
        IGenericRepository<WebPushSubscription> WebPushSubscriptionRepository { get; }

        Task CommitAsync();

        ICollection<Guid> GetAffectedUsers(params EntityState[] entityStates);
    }
}
