using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain.Account
{
    public class WebPushSubscription : BaseEntity
    {
        private const int endpointMaxLength = 2048;
        private const int keyMaxLength = 512;
        private const int userAgentMaxLength = 512;

        private WebPushSubscription() { }

        public WebPushSubscription(
            Guid userId,
            string endpoint,
            string p256dh,
            string auth,
            WebPushDeviceType deviceType = WebPushDeviceType.Browser,
            string userAgent = default)
        {
            SetUserId(userId);
            SetEndpoint(endpoint);
            SetP256dh(p256dh);
            SetAuth(auth);
            SetDeviceType(deviceType);
            SetUserAgent(userAgent);
            MarkAsUsed(DateTime.UtcNow);
            Activate();
        }

        public Guid UserId { get; private set; } = Guid.Empty;
        public string Endpoint { get; private set; } = string.Empty;
        public string P256dh { get; private set; } = string.Empty;
        public string Auth { get; private set; } = string.Empty;
        public string UserAgent { get; private set; } = string.Empty;
        public DateTime LastUsedAt { get; private set; } = DateTime.UtcNow;
        public DateTime? RevokedAt { get; private set; }
        public WebPushDeviceType DeviceType { get; private set; } = WebPushDeviceType.Browser;

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (UserId == Guid.Empty)
                    response.AddErrorMessage(nameof(UserId), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(UserId)));

                if (string.IsNullOrWhiteSpace(Endpoint))
                    response.AddErrorMessage(nameof(Endpoint), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Endpoint)));
                else if (Endpoint.Length > endpointMaxLength)
                    response.AddErrorMessage(nameof(Endpoint), string.Format(ValidationMessages.PropertyMaxLength, nameof(Endpoint), endpointMaxLength));

                if (string.IsNullOrWhiteSpace(P256dh))
                    response.AddErrorMessage(nameof(P256dh), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(P256dh)));
                else if (P256dh.Length > keyMaxLength)
                    response.AddErrorMessage(nameof(P256dh), string.Format(ValidationMessages.PropertyMaxLength, nameof(P256dh), keyMaxLength));

                if (string.IsNullOrWhiteSpace(Auth))
                    response.AddErrorMessage(nameof(Auth), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Auth)));
                else if (Auth.Length > keyMaxLength)
                    response.AddErrorMessage(nameof(Auth), string.Format(ValidationMessages.PropertyMaxLength, nameof(Auth), keyMaxLength));

                if (!string.IsNullOrWhiteSpace(UserAgent) && UserAgent.Length > userAgentMaxLength)
                    response.AddErrorMessage(nameof(UserAgent), string.Format(ValidationMessages.PropertyMaxLength, nameof(UserAgent), userAgentMaxLength));

                if (!Enum.IsDefined(typeof(WebPushDeviceType), DeviceType))
                    response.AddErrorMessage(nameof(DeviceType), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(DeviceType)));

                return response;
            }
        }

        public void SetUserId(Guid userId)
        {
            UserId = userId;
        }

        public void SetEndpoint(string endpoint)
        {
            Endpoint = endpoint?.Trim() ?? string.Empty;
        }

        public void SetP256dh(string p256dh)
        {
            P256dh = p256dh?.Trim() ?? string.Empty;
        }

        public void SetAuth(string auth)
        {
            Auth = auth?.Trim() ?? string.Empty;
        }

        public void SetUserAgent(string userAgent)
        {
            UserAgent = userAgent?.Trim() ?? string.Empty;
        }

        public void SetDeviceType(WebPushDeviceType deviceType)
        {
            DeviceType = deviceType;
        }

        public void MarkAsUsed(DateTime utcNow)
        {
            LastUsedAt = utcNow;
        }

        public void Revoke(DateTime utcNow)
        {
            RevokedAt = utcNow;
            LastUsedAt = utcNow;
        }

        public void Activate()
        {
            RevokedAt = null;
        }

        public void UpdateSubscription(
            Guid userId,
            string endpoint,
            string p256dh,
            string auth,
            WebPushDeviceType deviceType,
            string userAgent = default)
        {
            SetUserId(userId);
            SetEndpoint(endpoint);
            SetP256dh(p256dh);
            SetAuth(auth);
            SetDeviceType(deviceType);
            SetUserAgent(userAgent);
            Activate();
            MarkAsUsed(DateTime.UtcNow);
        }
    }
}
