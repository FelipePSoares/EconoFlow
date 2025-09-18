using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.NotificationService
{
    public interface INotificationService
    {
        Task<AppResponse<ICollection<NotificationResponseDTO>>> GetAllAsync(Guid userId);

        Task<AppResponse<ICollection<NotificationResponseDTO>>> GetUnreadAsync(Guid userId, NotificationCategory notificationCategory = NotificationCategory.None);

        Task<AppResponse> MarkAsReadAsync(Guid userId, Guid notificationId);

        Task<AppResponse> MarkAllAsReadAsync(Guid userId);
    }
}
