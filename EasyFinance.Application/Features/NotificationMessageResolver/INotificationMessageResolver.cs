using EasyFinance.Domain.Account;

namespace EasyFinance.Application.Features.NotificationMessageResolver
{
    public interface INotificationMessageResolver
    {
        string ResolveBody(Notification notification);
    }
}
