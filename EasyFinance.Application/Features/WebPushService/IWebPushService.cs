using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.DTOs.BackgroundService.Notification;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.WebPushService
{
    public interface IWebPushService
    {
        AppResponse<WebPushPublicKeyResponseDTO> GetPublicKey();
        Task<AppResponse> UpsertSubscriptionAsync(Guid userId, WebPushSubscriptionRequestDTO dto, CancellationToken cancellationToken);
        Task<AppResponse> UnsubscribeAsync(Guid userId, string endpoint, CancellationToken cancellationToken);
        Task<AppResponse> SendPayloadToUserAsync(Guid userId, WebPushPayload payload, CancellationToken cancellationToken);
        Task<AppResponse> SendPayloadToUsersAsync(IEnumerable<Guid> userIds, WebPushPayload payload, CancellationToken cancellationToken);
        Task<AppResponse> BroadcastAsync(WebPushPayload payload, CancellationToken cancellationToken);
        Task<AppResponse> SendTestNotificationAsync(Guid userId, CancellationToken cancellationToken);
        Task<AppResponse> SendNotificationAsync(Notification notification, CancellationToken cancellationToken);
    }
}
