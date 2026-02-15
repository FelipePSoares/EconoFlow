using System;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;

namespace EasyFinance.Application.DTOs.Account
{
    public class NotificationRequestDTO
    {
        public User User { get; set; } = new User();
        public NotificationType Type { get; set; } = NotificationType.None;
        public string CodeMessage { get; set; } = default;
        public string ActionLabelCode { get; set; } = default;
        public bool IsActionRequired { get; set; } = false;
        public NotificationCategory Category { get; set; } = NotificationCategory.None;
        public bool IsSticky { get; set; } = false;
        public NotificationChannels LimitNotificationChannels { get; set; } = NotificationChannels.None;
        public DateOnly? ExpiresAt { get; set; } = default;
        public string Metadata { get; set; } = default;
    }
}
