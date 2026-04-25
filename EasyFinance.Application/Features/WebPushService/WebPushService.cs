using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.DTOs.BackgroundService.Notification;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WebPush;

namespace EasyFinance.Application.Features.WebPushService
{
    public class WebPushService(
        IUnitOfWork unitOfWork,
        IOptions<WebPushOptions> webPushOptions,
        UserManager<User> userManager,
        IFeatureRolloutService featureRolloutService,
        ILogger<WebPushService> logger) : IWebPushService
    {
        private static readonly JsonSerializerOptions serializerOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        private readonly IUnitOfWork unitOfWork = unitOfWork;
        private readonly WebPushOptions webPushOptions = webPushOptions.Value;
        private readonly UserManager<User> userManager = userManager;
        private readonly IFeatureRolloutService featureRolloutService = featureRolloutService;
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

            if (!await IsFeatureEnabledForUserAsync(userId, cancellationToken))
                return AppResponse.Error("Web push is not enabled for this user.");

            var endpoint = dto.Endpoint?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(endpoint))
                return AppResponse.Error("Endpoint is required.");

            var existingSubscription = await unitOfWork.WebPushSubscriptionRepository
                .Trackable()
                .FirstOrDefaultAsync(s => s.Endpoint == endpoint, cancellationToken);

            if (existingSubscription != null
                && existingSubscription.UserId != userId
                && !existingSubscription.RevokedAt.HasValue)
            {
                return AppResponse.Error("forbidden", "Subscription endpoint is already registered to another user.");
            }

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
            logger.LogInformation(
                "Web push subscription {SubscriptionId} saved for user {UserId} ({DeviceType}).",
                existingSubscription.Id,
                userId,
                existingSubscription.DeviceType);
            return AppResponse.Success();
        }

        public async Task<AppResponse> UnsubscribeAsync(Guid userId, string endpoint, CancellationToken cancellationToken)
        {
            var normalizedEndpoint = endpoint?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(normalizedEndpoint))
                return AppResponse.Error("Endpoint is required.");

            var subscription = await unitOfWork.WebPushSubscriptionRepository
                .Trackable()
                .FirstOrDefaultAsync(s => s.Endpoint == normalizedEndpoint, cancellationToken);

            // Idempotent behavior for already-removed subscriptions.
            if (subscription == null)
                return AppResponse.Success();

            if (subscription.UserId != userId)
                return AppResponse.Error("forbidden", "Subscription endpoint does not belong to the authenticated user.");

            unitOfWork.WebPushSubscriptionRepository.Delete(subscription);
            await unitOfWork.CommitAsync();
            logger.LogInformation(
                "Web push subscription {SubscriptionId} deleted for user {UserId}.",
                subscription.Id,
                userId);
            return AppResponse.Success();
        }

        public Task<AppResponse> SendPayloadToUserAsync(Guid userId, WebPushPayload payload, CancellationToken cancellationToken)
            => SendPayloadToSingleUserAsync(userId, payload, cancellationToken);

        public async Task<AppResponse> SendPayloadToUsersAsync(IEnumerable<Guid> userIds, WebPushPayload payload, CancellationToken cancellationToken)
        {
            if (userIds == null)
                return AppResponse.Error("At least one user is required.");

            if (payload == null)
                return AppResponse.Error("Web push payload is required.");

            var errors = new List<AppMessage>();
            foreach (var userId in userIds.Where(id => id != Guid.Empty).Distinct())
            {
                var result = await SendPayloadToSingleUserAsync(userId, payload, cancellationToken);
                if (result.Failed)
                {
                    errors.AddRange(result.Messages.Select(message => new AppMessage(
                        message.Code,
                        $"User {userId}: {message.Description}")));
                }
            }

            if (errors.Count > 0)
                return AppResponse.Error(errors);

            return AppResponse.Success();
        }

        public async Task<AppResponse> BroadcastAsync(WebPushPayload payload, CancellationToken cancellationToken)
        {
            if (payload == null)
                return AppResponse.Error("Web push payload is required.");

            var userIds = await unitOfWork.WebPushSubscriptionRepository
                .NoTrackable()
                .Where(subscription => !subscription.RevokedAt.HasValue)
                .Select(subscription => subscription.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            return await SendPayloadToUsersAsync(userIds, payload, cancellationToken);
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
                    Icon = "/assets/images/logo-without-text-background-512.png",
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
                    Body = ResolveNotificationBody(notification),
                    Url = ResolveActionUrl(notification),
                    Tag = $"notification-{notification.Id}",
                    RequireInteraction = notification.IsSticky,
                    Icon = "/assets/images/logo-without-text-background-512.png",
                    Badge = "/assets/images/logo-minimalist-192.png"
                },
                cancellationToken);
        }

        private async Task<AppResponse> SendPayloadToSingleUserAsync(Guid userId, WebPushPayload payload, CancellationToken cancellationToken)
        {
            if (payload == null)
                return AppResponse.Error("Web push payload is required.");

            if (!await IsFeatureEnabledForUserAsync(userId, cancellationToken))
                return AppResponse.Success();

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
            var subscriptionsToUpdate = new List<WebPushSubscription>(subscriptions.Count);
            var subscriptionsToDelete = new List<WebPushSubscription>(subscriptions.Count);

            foreach (var subscription in subscriptions)
            {
                var deliveryOutcome = await TrySendWithRetryAsync(
                    client,
                    subscription,
                    payloadJson,
                    vapidDetailsResult.Data,
                    userId,
                    cancellationToken);

                if (deliveryOutcome == WebPushDeliveryOutcome.Sent)
                {
                    subscription.MarkAsUsed(utcNow);
                    subscriptionsToUpdate.Add(subscription);
                    successfulDeliveries++;
                }
                else if (deliveryOutcome == WebPushDeliveryOutcome.InvalidSubscription)
                {
                    subscriptionsToDelete.Add(subscription);
                }
                else
                {
                    failedDeliveries++;
                }
            }

            foreach (var touchedSubscription in subscriptionsToUpdate.DistinctBy(s => s.Id))
            {
                var saveResult = unitOfWork.WebPushSubscriptionRepository.InsertOrUpdate(touchedSubscription);
                if (saveResult.Failed)
                    return AppResponse.Error(saveResult.Messages);
            }

            foreach (var invalidSubscription in subscriptionsToDelete.DistinctBy(s => s.Id))
                unitOfWork.WebPushSubscriptionRepository.Delete(invalidSubscription);

            if (subscriptionsToUpdate.Count > 0 || subscriptionsToDelete.Count > 0)
                await unitOfWork.CommitAsync();

            logger.LogInformation(
                "Web push delivery results for user {UserId}. Total: {TotalSubscriptions}, Sent: {SuccessfulDeliveries}, InvalidRemoved: {InvalidSubscriptions}, Failed: {FailedDeliveries}.",
                userId,
                subscriptions.Count,
                successfulDeliveries,
                subscriptionsToDelete.Count,
                failedDeliveries);

            if (successfulDeliveries == 0 && failedDeliveries > 0)
                return AppResponse.Error("Failed to send web push notification.");

            return AppResponse.Success();
        }

        private async Task<WebPushDeliveryOutcome> TrySendWithRetryAsync(
            WebPushClient client,
            WebPushSubscription subscription,
            string payloadJson,
            VapidDetails vapidDetails,
            Guid userId,
            CancellationToken cancellationToken)
        {
            var maxAttempts = Math.Max(1, webPushOptions.MaxDeliveryAttempts);
            var baseDelayMs = Math.Max(1, webPushOptions.RetryBaseDelayMilliseconds);

            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    await client.SendNotificationAsync(
                        new PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth),
                        payloadJson,
                        vapidDetails,
                        cancellationToken);

                    return WebPushDeliveryOutcome.Sent;
                }
                catch (WebPushException ex) when (IsInvalidSubscriptionStatus(ex.StatusCode))
                {
                    logger.LogInformation(
                        "Removing invalid web push subscription {SubscriptionId} for user {UserId}. Provider status: {StatusCode}.",
                        subscription.Id,
                        userId,
                        ex.StatusCode);
                    return WebPushDeliveryOutcome.InvalidSubscription;
                }
                catch (WebPushException ex) when (IsTransientStatus(ex.StatusCode) && attempt < maxAttempts)
                {
                    var delay = TimeSpan.FromMilliseconds(baseDelayMs * attempt);
                    logger.LogWarning(
                        ex,
                        "Transient web push failure for subscription {SubscriptionId} (user {UserId}) with status {StatusCode}. Retrying attempt {Attempt}/{MaxAttempts} in {DelayMs}ms.",
                        subscription.Id,
                        userId,
                        ex.StatusCode,
                        attempt + 1,
                        maxAttempts,
                        (int)delay.TotalMilliseconds);
                    await Task.Delay(delay, cancellationToken);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(
                        ex,
                        "Failed to send web push notification to subscription {SubscriptionId} for user {UserId}.",
                        subscription.Id,
                        userId);
                    return WebPushDeliveryOutcome.Failed;
                }
            }

            logger.LogWarning(
                "Exceeded retry attempts while sending web push notification to subscription {SubscriptionId} for user {UserId}.",
                subscription.Id,
                userId);
            return WebPushDeliveryOutcome.Failed;
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

        private static string ResolveActionUrl(Notification notification)
        {
            var actionUrlFromMetadata = ResolveActionUrlFromMetadata(notification.Metadata);
            if (!string.IsNullOrWhiteSpace(actionUrlFromMetadata))
                return actionUrlFromMetadata;

            return ResolveActionUrlFromActionLabel(notification.ActionLabelCode);
        }

        private static string ResolveNotificationBody(Notification notification)
        {
            var culture = ResolveNotificationCulture(notification.User?.Culture);
            var projectName = ResolveMetadataValue(notification.Metadata, "ProjectName");

            if (string.Equals(notification.CodeMessage, EmailTemplates.GrantedAccess.ToString(), StringComparison.Ordinal))
            {
                var messageTemplate = string.IsNullOrWhiteSpace(projectName)
                    ? NotificationMessages.ResourceManager.GetString(nameof(NotificationMessages.ProjectInvitationPushBodyNoProject), culture)
                    : NotificationMessages.ResourceManager.GetString(nameof(NotificationMessages.ProjectInvitationPushBodyWithProject), culture);

                if (string.IsNullOrWhiteSpace(messageTemplate))
                    return notification.CodeMessage;

                return string.IsNullOrWhiteSpace(projectName)
                    ? messageTemplate
                    : string.Format(culture, messageTemplate, projectName);
            }

            if (string.Equals(notification.CodeMessage, EmailTemplates.AccessLevelChanged.ToString(), StringComparison.Ordinal))
            {
                var messageTemplate = NotificationMessages.ResourceManager.GetString(nameof(NotificationMessages.ProjectAccessLevelChangedPushBody), culture);
                if (string.IsNullOrWhiteSpace(messageTemplate))
                    return notification.CodeMessage;

                var inviterName = ResolveMetadataValue(notification.Metadata, "FullName");
                var roleValue = ResolveMetadataValue(notification.Metadata, "Role");
                var roleLabel = ResolveRoleLabel(roleValue, culture);

                return string.Format(culture, messageTemplate, inviterName, roleLabel, projectName);
            }

            return NotificationMessages.ResourceManager.GetString(notification.CodeMessage, culture) ?? notification.CodeMessage;
        }

        private static CultureInfo ResolveNotificationCulture(CultureInfo culture)
            => culture ?? CultureInfo.InvariantCulture;

        private static string ResolveRoleLabel(string roleValue, CultureInfo culture)
        {
            if (string.IsNullOrWhiteSpace(roleValue))
                return string.Empty;

            if (!Enum.TryParse<Role>(roleValue, ignoreCase: true, out var role))
                return roleValue;

            var key = role switch
            {
                Role.Viewer => nameof(NotificationMessages.NotificationRoleViewer),
                Role.Manager => nameof(NotificationMessages.NotificationRoleManager),
                Role.Admin => nameof(NotificationMessages.NotificationRoleAdmin),
                _ => string.Empty
            };

            if (string.IsNullOrWhiteSpace(key))
                return roleValue;

            return NotificationMessages.ResourceManager.GetString(key, culture) ?? roleValue;
        }

        private static string ResolveActionUrlFromActionLabel(string actionLabelCode)
        {
            if (string.Equals(actionLabelCode, "ButtonMyProfile", StringComparison.Ordinal))
                return "/user";

            if (string.Equals(actionLabelCode, "ButtonConfigureTwoFactor", StringComparison.Ordinal))
                return "/user/authentication";

            return "/";
        }

        private static string ResolveActionUrlFromMetadata(string metadata)
        {
            var actionPath = ResolveMetadataValue(metadata, "actionPath");
            if (string.IsNullOrWhiteSpace(actionPath))
                return string.Empty;

            return NormalizeActionUrl(actionPath);
        }

        private static string NormalizeActionUrl(string actionUrl)
        {
            if (string.IsNullOrWhiteSpace(actionUrl))
                return string.Empty;

            var normalizedActionUrl = actionUrl.Trim();
            if (normalizedActionUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                || normalizedActionUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return string.Empty;
            }

            if (normalizedActionUrl.StartsWith('/'))
                return normalizedActionUrl;

            return $"/{normalizedActionUrl}";
        }

        private static string ResolveMetadataValue(string metadata, string key)
        {
            if (string.IsNullOrWhiteSpace(metadata))
                return string.Empty;

            try
            {
                var parsedMetadata = JsonSerializer.Deserialize<Dictionary<string, string>>(metadata);
                if (parsedMetadata == null)
                    return string.Empty;

                if (parsedMetadata.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
                    return value.Trim();

                var caseInsensitiveMatch = parsedMetadata.FirstOrDefault(entry => string.Equals(entry.Key, key, StringComparison.OrdinalIgnoreCase));
                if (caseInsensitiveMatch.Equals(default(KeyValuePair<string, string>)) || string.IsNullOrWhiteSpace(caseInsensitiveMatch.Value))
                    return string.Empty;

                return caseInsensitiveMatch.Value.Trim();
            }
            catch (JsonException)
            {
                return string.Empty;
            }
        }

        private async Task<bool> IsFeatureEnabledForUserAsync(Guid userId, CancellationToken cancellationToken)
        {
            var user = await this.userManager.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

            if (user == null || !user.Enabled)
                return false;

            var roles = await this.userManager.GetRolesAsync(user);
            return this.featureRolloutService.IsEnabled(roles, FeatureFlags.WebPush);
        }

        private static bool IsInvalidSubscriptionStatus(HttpStatusCode statusCode)
            => statusCode == HttpStatusCode.NotFound || statusCode == HttpStatusCode.Gone;

        private static bool IsTransientStatus(HttpStatusCode statusCode)
            => statusCode == HttpStatusCode.RequestTimeout
            || statusCode == HttpStatusCode.TooManyRequests
            || statusCode == HttpStatusCode.InternalServerError
            || statusCode == HttpStatusCode.BadGateway
            || statusCode == HttpStatusCode.ServiceUnavailable
            || statusCode == HttpStatusCode.GatewayTimeout;

        private enum WebPushDeliveryOutcome
        {
            Sent = 0,
            InvalidSubscription = 1,
            Failed = 2
        }

    }
}
