using System;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Domain.Account;

namespace EasyFinance.Application.DTOs.Account
{
    public class NotificationResponseDTO
    {
        public NotificationResponseDTO(Notification notification)
        {
            this.Id = notification.Id;
            this.User = new UserResponseDTO(notification.User);
            this.CodeMessage = notification.CodeMessage;
            this.ActionLabelCode = notification.ActionLabelCode;
            this.Metadata = notification.Metadata;
            this.Type = notification.Type;
            this.Category = notification.Category;
            this.IsRead = notification.IsRead;
            this.IsSent = notification.IsSent;
            this.IsSticky = notification.IsSticky;
            this.LimitNotificationChannels = notification.LimitNotificationChannels;
            this.ExpiresAt = notification.ExpiresAt;
        }

        public Guid Id { get; set; }
        public UserResponseDTO User { get; set; } = default;
        public string CodeMessage { get; set; } = default!;
        public string ActionLabelCode { get; set; } = default!;
        public string Metadata { get; set; } = default!;
        public NotificationType Type { get; set; } = NotificationType.None;
        public NotificationCategory Category { get; set; } = NotificationCategory.None;
        public bool IsRead { get; set; } = false;
        public bool IsSent { get; set; } = false;
        public bool IsSticky { get; set; } = false;
        public NotificationChannels LimitNotificationChannels { get; set; } = NotificationChannels.None;
        public DateOnly? ExpiresAt { get; set; } = default;
    }
}
