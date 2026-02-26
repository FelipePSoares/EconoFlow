using System;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.WebPushService
{
    public interface IWebPushService
    {
        AppResponse<WebPushPublicKeyResponseDTO> GetPublicKey();
        Task<AppResponse> UpsertSubscriptionAsync(Guid userId, WebPushSubscriptionRequestDTO dto, CancellationToken cancellationToken);
        Task<AppResponse> SendTestNotificationAsync(Guid userId, CancellationToken cancellationToken);
        Task<AppResponse> SendNotificationAsync(Notification notification, CancellationToken cancellationToken);
    }
}
