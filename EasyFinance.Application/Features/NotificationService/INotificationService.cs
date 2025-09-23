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
        Task<AppResponse> AddNotificationAsync(Notification notification);

        Task<AppResponse<ICollection<NotificationResponseDTO>>> GetAllAsync(Guid userId);

        Task<AppResponse<ICollection<NotificationResponseDTO>>> GetUnreadAsync(Guid userId, NotificationCategory notificationCategory = NotificationCategory.None);

        Task<AppResponse> MarkAsReadAsync(Guid userId, Guid notificationId);

        Task<AppResponse> MarkAllAsReadAsync(Guid userId);

        /// <summary>
        /// This method is intended to be used when an user makes an action that was required by a notification.
        /// For example, if the user had a notification to verify their email, and they verified it, this method would be called.
        /// It will mark as read all notifications of the given type that are action required.
        /// </summary>
        Task<AppResponse> ActionMadeAsync(Guid userId, NotificationType type);
    }
}
