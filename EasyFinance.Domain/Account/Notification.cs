using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Infrastructure.Extensions;
using System;

namespace EasyFinance.Domain.Account
{
    public class Notification : BaseEntity
    {
        private Notification() { }

        public Notification(
            User user = default,
            string codeMessage = default,
            string actionLabelCode = default,
            string metadata = default,
            NotificationType type = NotificationType.None,
            NotificationCategory category = NotificationCategory.None,
            NotificationChannels limitNotificationChannels = NotificationChannels.None,
            DateOnly? expiresAt = default
            )
        {
            SetUser(user);
            SetCodeMessage(codeMessage);
            SetActionLabelCode(actionLabelCode);
            SetMetadata(metadata);
            SetType(type);
            SetCategory(category);
            SetLimitNotificationChannels(limitNotificationChannels);
            SetExpiresAt(expiresAt);
        }

        public User User { get; private set; } = new User();
        public NotificationType Type { get; private set; } = NotificationType.None;
        public string CodeMessage { get; private set; } = default;
        public NotificationCategory Category { get; private set; } = NotificationCategory.None;
        public bool IsRead { get; private set; } = false;
        public bool IsSent { get; private set; } = false;
        public bool IsSticky { get; private set; } = false;
        public NotificationChannels LimitNotificationChannels { get; private set; } = NotificationChannels.None;
        public DateOnly? ExpiresAt { get; private set; } = default;
        public string ActionLabelCode { get; private set; } = default;
        public string Metadata { get; private set; } = default;

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (Type == NotificationType.None)
                    response.AddErrorMessage(nameof(Type), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Type)));

                if (Type == NotificationType.None)
                    response.AddErrorMessage(nameof(Type), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Type)));

                if (string.IsNullOrEmpty(CodeMessage))
                    response.AddErrorMessage(nameof(CodeMessage), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(CodeMessage)));

                if (Category == NotificationCategory.None)
                    response.AddErrorMessage(nameof(Category), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Category)));

                var userValidation = User.Validate;
                if (userValidation.Failed)
                    response.AddErrorMessage(userValidation.Messages.AddPrefix(nameof(User)));

                return response;
            }
        }

        public void SetExpiresAt(DateOnly? expiresAt) => ExpiresAt = expiresAt;

        public void SetLimitNotificationChannels(NotificationChannels limitNotificationChannels) => LimitNotificationChannels = limitNotificationChannels;

        public void SetCategory(NotificationCategory category) => Category = category;

        public void SetType(NotificationType type) => Type = type;

        public void SetMetadata(string metadata) => Metadata = metadata;

        public void SetActionLabelCode(string actionLabelCode) => ActionLabelCode = actionLabelCode;

        public void SetCodeMessage(string codeMessage) => CodeMessage = codeMessage;

        public void MarkAsRead() => IsRead = true;

        public void MarkAsSent() => IsSent = true;

        public void SetIsSticky(bool isSticky) => IsSticky = isSticky;

        public void SetUser(User user) => User = user ?? throw new ArgumentNullException(nameof(user));
    }
}
