using System.Threading.Tasks;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.BackgroundServices.NotifierBackgroundService.Channels
{
    public interface INotificationChannel
    {
        Task<AppResponse> SendAsync(Notification notification);
    }
}
