using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.DTOs.BackgroundService.Notification;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WebPush;

namespace EasyFinance.Application.Features.WebPushService
{
    public class WebPushService(
        IUnitOfWork unitOfWork,
        IOptions<WebPushOptions> webPushOptions,
        ILogger<WebPushService> logger) : IWebPushService
    {
        private static readonly JsonSerializerOptions serializerOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        private readonly IUnitOfWork unitOfWork = unitOfWork;
        private readonly WebPushOptions webPushOptions = webPushOptions.Value;
        private readonly ILogger<WebPushService> logger = logger;

        public AppResponse<WebPushPublicKeyResponseDTO> GetPublicKey()
        {
            var publicKey = ResolvePublicKey();
            if (string.IsNullOrWhiteSpace(publicKey))
                return AppResponse<WebPushPublicKeyResponseDTO>.Error("Web push public key is not configured.");

            return AppResponse<WebPushPublicKeyResponseDTO>.Success(new WebPushPublicKeyResponseDTO
            {
                PublicKey = publicKey
            });
        }

        public async Task<AppResponse> UpsertSubscriptionAsync(Guid userId, WebPushSubscriptionRequestDTO dto, CancellationToken cancellationToken)
        {
            if (dto == null)
                return AppResponse.Error("Web push subscription payload is required.");

            var endpoint = dto.Endpoint?.Trim() ?? string.Empty;
            var existingSubscription = await unitOfWork.WebPushSubscriptionRepository
                .Trackable()
                .FirstOrDefaultAsync(s => s.Endpoint == endpoint, cancellationToken);

            if (existingSubscription == null)
            {
                existingSubscription = new WebPushSubscription(
                    userId: userId,
                    endpoint: dto.Endpoint,
                    p256dh: dto.P256dh,
                    auth: dto.Auth,
                    deviceType: dto.DeviceType,
                    userAgent: dto.UserAgent);
            }
            else
            {
                existingSubscription.UpdateSubscription(
                    userId: userId,
                    endpoint: dto.Endpoint,
                    p256dh: dto.P256dh,
                    auth: dto.Auth,
                    deviceType: dto.DeviceType,
                    userAgent: dto.UserAgent);
            }

            var saveResult = unitOfWork.WebPushSubscriptionRepository.InsertOrUpdate(existingSubscription);
            if (saveResult.Failed)
                return AppResponse.Error(saveResult.Messages);

            await unitOfWork.CommitAsync();
            return AppResponse.Success();
        }

        public Task<AppResponse> SendTestNotificationAsync(Guid userId, CancellationToken cancellationToken)
            => SendPayloadToUserAsync(
                userId,
                new WebPushPayload
                {
                    Title = "EconoFlow",
                    Body = "Web push notifications are now active.",
                    Url = "/",
                    Tag = $"web-push-test-{Guid.NewGuid():N}",
                    Icon = "/assets/images/logo-without-text-background-512-min.png",
                    Badge = "/assets/images/logo-minimalist-192.png"
                },
                cancellationToken);

        public Task<AppResponse> SendNotificationAsync(Notification notification, CancellationToken cancellationToken)
        {
            if (notification?.User == null || notification.User.Id == Guid.Empty)
                return Task.FromResult(AppResponse.Error("Notification user is invalid for web push delivery."));

            return SendPayloadToUserAsync(
                notification.User.Id,
                new WebPushPayload
                {
                    Title = "EconoFlow",
                    Body = notification.CodeMessage,
                    Url = ResolveActionUrl(notification.ActionLabelCode),
                    Tag = $"notification-{notification.Id}",
                    RequireInteraction = notification.IsSticky,
                    Icon = "/assets/images/logo-without-text-background-512-min.png",
                    Badge = "/assets/images/logo-minimalist-192.png"
                },
                cancellationToken);
        }

        private async Task<AppResponse> SendPayloadToUserAsync(Guid userId, WebPushPayload payload, CancellationToken cancellationToken)
        {
            var subscriptions = await unitOfWork.WebPushSubscriptionRepository
                .Trackable()
                .Where(s => s.UserId == userId && !s.RevokedAt.HasValue)
                .ToListAsync(cancellationToken);

            if (subscriptions.Count == 0)
                return AppResponse.Success();

            var vapidDetailsResult = BuildVapidDetails();
            if (vapidDetailsResult.Failed)
                return AppResponse.Error(vapidDetailsResult.Messages);

            var client = new WebPushClient();
            var payloadJson = JsonSerializer.Serialize(payload, serializerOptions);
            var utcNow = DateTime.UtcNow;
            var successfulDeliveries = 0;
            var failedDeliveries = 0;
            var touchedSubscriptions = new List<WebPushSubscription>(subscriptions.Count);

            foreach (var subscription in subscriptions)
            {
                try
                {
                    await client.SendNotificationAsync(
                        new PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth),
                        payloadJson,
                        vapidDetailsResult.Data,
                        cancellationToken);

                    subscription.MarkAsUsed(utcNow);
                    touchedSubscriptions.Add(subscription);
                    successfulDeliveries++;
                }
                catch (WebPushException ex) when (ex.StatusCode == HttpStatusCode.NotFound || ex.StatusCode == HttpStatusCode.Gone)
                {
                    subscription.Revoke(utcNow);
                    touchedSubscriptions.Add(subscription);
                    logger.LogInformation(
                        "Web push subscription {SubscriptionId} for user {UserId} was revoked after provider response {StatusCode}.",
                        subscription.Id,
                        userId,
                        ex.StatusCode);
                }
                catch (Exception ex)
                {
                    failedDeliveries++;
                    logger.LogWarning(
                        ex,
                        "Failed to send web push notification to subscription {SubscriptionId} for user {UserId}.",
                        subscription.Id,
                        userId);
                }
            }

            foreach (var touchedSubscription in touchedSubscriptions.DistinctBy(s => s.Id))
            {
                var saveResult = unitOfWork.WebPushSubscriptionRepository.InsertOrUpdate(touchedSubscription);
                if (saveResult.Failed)
                    return AppResponse.Error(saveResult.Messages);
            }

            if (touchedSubscriptions.Count > 0)
                await unitOfWork.CommitAsync();

            if (successfulDeliveries == 0 && failedDeliveries > 0)
                return AppResponse.Error("Failed to send web push notification.");

            return AppResponse.Success();
        }

        private AppResponse<VapidDetails> BuildVapidDetails()
        {
            var subject = ResolveSubject();
            var publicKey = ResolvePublicKey();
            var privateKey = ResolvePrivateKey();

            if (string.IsNullOrWhiteSpace(subject)
                || string.IsNullOrWhiteSpace(publicKey)
                || string.IsNullOrWhiteSpace(privateKey))
            {
                return AppResponse<VapidDetails>.Error("Web push VAPID settings are not configured.");
            }

            return AppResponse<VapidDetails>.Success(new VapidDetails(subject, publicKey, privateKey));
        }

        private string ResolveSubject()
            => ResolveSetting(webPushOptions.Subject, "EconoFlow_WEB_PUSH_SUBJECT");

        private string ResolvePublicKey()
            => ResolveSetting(webPushOptions.PublicKey, "EconoFlow_WEB_PUSH_PUBLIC_KEY");

        private string ResolvePrivateKey()
            => ResolveSetting(webPushOptions.PrivateKey, "EconoFlow_WEB_PUSH_PRIVATE_KEY");

        private static string ResolveSetting(string configuredValue, string environmentVariableName)
        {
            if (!string.IsNullOrWhiteSpace(configuredValue))
                return configuredValue.Trim();

            return (Environment.GetEnvironmentVariable(environmentVariableName) ?? string.Empty).Trim();
        }

        private static string ResolveActionUrl(string actionLabelCode)
        {
            if (string.Equals(actionLabelCode, "ButtonMyProfile", StringComparison.Ordinal))
                return "/user";

            if (string.Equals(actionLabelCode, "ButtonConfigureTwoFactor", StringComparison.Ordinal))
                return "/user/authentication";

            return "/";
        }

    }
}
