using System;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain.Account
{
    public class Notification : BaseEntity
    {
        private Notification() { }

        public Notification(
            User user,
            string codeMessage,
            NotificationType type,
            NotificationCategory category,
            string actionLabelCode = default,
            NotificationChannels limitNotificationChannels = NotificationChannels.None,
            DateOnly? expiresAt = default,
            string metadata = default,
            bool isSticky = false,
            bool isSent = false
            )
        {
            this.User = user ?? throw new ArgumentNullException(nameof(user));
            SetCodeMessage(codeMessage);
            SetActionLabelCode(actionLabelCode);
            SetMetadata(metadata);
            SetType(type);
            SetCategory(category);
            SetLimitNotificationChannels(limitNotificationChannels);
            SetExpiresAt(expiresAt);
            if (isSticky)
                MarkAsSticky();
            if (isSent)
                MarkAsSent();
        }

        public User User { get; private set; } = new User();
        public NotificationType Type { get; private set; } = NotificationType.None;
        public string CodeMessage { get; private set; } = default;
        public string ActionLabelCode { get; private set; } = default;
        public bool IsActionRequired { get; private set; } = false;
        public NotificationCategory Category { get; private set; } = NotificationCategory.None;
        public bool IsRead { get; private set; } = false;
        public bool IsSent { get; private set; } = false;
        public bool IsSticky { get; private set; } = false;
        public NotificationChannels LimitNotificationChannels { get; private set; } = NotificationChannels.None;
        public DateOnly? ExpiresAt { get; private set; } = default;
        public string Metadata { get; private set; } = default;

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (Type == NotificationType.None)
                    response.AddErrorMessage(nameof(Type), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Type)));

                if (Category == NotificationCategory.None)
                    response.AddErrorMessage(nameof(Category), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Category)));

                if (string.IsNullOrEmpty(CodeMessage))
                    response.AddErrorMessage(nameof(CodeMessage), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(CodeMessage)));
                else if (CodeMessage.Length > 100)
                    response.AddErrorMessage(nameof(CodeMessage), string.Format(ValidationMessages.PropertyMaxLength, nameof(CodeMessage), 100));

                if (IsActionRequired && ActionLabelCode.Length > 100)
                    response.AddErrorMessage(nameof(ActionLabelCode), string.Format(ValidationMessages.PropertyMaxLength, nameof(ActionLabelCode), 100));

                if (ExpiresAt.HasValue && ExpiresAt.Value <= DateOnly.FromDateTime(DateTime.UtcNow))
                    response.AddErrorMessage(nameof(ExpiresAt), ValidationMessages.ExpirationShouldBeFutureDate);

                if (User.Id == Guid.Empty)
                    response.AddErrorMessage(nameof(User), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(User)));

                return response;
            }
        }

        public void SetExpiresAt(DateOnly? expiresAt) => ExpiresAt = expiresAt;

        public void SetLimitNotificationChannels(NotificationChannels limitNotificationChannels) => LimitNotificationChannels = limitNotificationChannels;

        public void SetCategory(NotificationCategory category) => Category = category;

        public void SetType(NotificationType type) => Type = type;

        public void SetMetadata(string metadata) => Metadata = metadata;

        public void SetActionLabelCode(string actionLabelCode)
        {
            this.IsActionRequired = !string.IsNullOrEmpty(actionLabelCode);

            ActionLabelCode = actionLabelCode;
        }

        public void SetCodeMessage(string codeMessage) => CodeMessage = codeMessage;

        public void MarkAsRead() => IsRead = true;

        public void MarkAsSent() => IsSent = true;

        public void MarkAsSticky() => IsSticky = true;
    }
}
