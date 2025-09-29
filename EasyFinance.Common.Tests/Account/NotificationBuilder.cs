using AutoFixture;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using System;
using System.Net.Mail;

namespace EasyFinance.Common.Tests.AccessControl
{
    public class NotificationBuilder : BaseTests, IBuilder<Notification>
    {
        private Notification notification;

        public NotificationBuilder()
        {
            this.notification = new Notification(
                new UserBuilder().Build(),
                Fixture.Create<string>(),
                NotificationType.EmailConfirmation,
                NotificationCategory.System,
                Fixture.Create<string>());
        }

        public NotificationBuilder AddExpiresAt(DateOnly expiresAt)
        {
            this.notification.SetExpiresAt(expiresAt);
            return this;
        }

        public NotificationBuilder AddLimitNotificationChannels(NotificationChannels channels)
        {
            this.notification.SetLimitNotificationChannels(channels);
            return this;
        }

        public NotificationBuilder AddCategory(NotificationCategory category)
        {
            this.notification.SetCategory(category);
            return this;
        }

        public NotificationBuilder AddType(NotificationType type)
        {
            this.notification.SetType(type);
            return this;
        }

        public NotificationBuilder AddMetadata(string metadata)
        {
            this.notification.SetMetadata(metadata);
            return this;
        }

        public NotificationBuilder AddActionLabelCode(string actionLabelCode)
        {
            this.notification.SetActionLabelCode(actionLabelCode);
            return this;
        }

        public NotificationBuilder AddCodeMessage(string codeMessage)
        {
            this.notification.SetCodeMessage(codeMessage);
            return this;
        }

        public NotificationBuilder SetIsRead()
        {
            this.notification.MarkAsRead();
            return this;
        }

        public NotificationBuilder SetIsSent()
        {
            this.notification.MarkAsSent();
            return this;
        }

        public NotificationBuilder SetIsSticky()
        {
            this.notification.MarkAsSticky();
            return this;
        }

        public Notification Build() => this.notification;

    }
}
