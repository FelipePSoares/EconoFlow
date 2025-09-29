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
            this.CodeMessage = notification.CodeMessage;
            this.ActionLabelCode = notification.ActionLabelCode;
            this.Type = notification.Type;
            this.Category = notification.Category;
            this.IsActionRequired = notification.IsActionRequired;
            this.IsSticky = notification.IsSticky;
            this.Metadata = notification.Metadata;
        }

        public Guid Id { get; set; }
        public string CodeMessage { get; set; } = default!;
        public string ActionLabelCode { get; set; } = default!;
        public NotificationType Type { get; set; } = NotificationType.None;
        public NotificationCategory Category { get; set; } = NotificationCategory.None;
        public bool IsActionRequired { get; set; } = false;
        public bool IsSticky { get; set; } = false;
        public string Metadata { get; set; } = default!;
    }
}
