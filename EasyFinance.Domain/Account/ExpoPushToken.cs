using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain.Account
{
    public class ExpoPushToken : BaseEntity
    {
        private const int TokenMaxLength = 512;
        private const int DeviceNameMaxLength = 256;

        private ExpoPushToken() { }

        public ExpoPushToken(Guid userId, string token, string? deviceName = null)
        {
            SetUserId(userId);
            SetToken(token);
            if (deviceName != null)
                SetDeviceName(deviceName);
        }

        public Guid UserId { get; private set; } = Guid.Empty;
        public string Token { get; private set; } = string.Empty;
        public string? DeviceName { get; private set; }
        public DateTime? RevokedAt { get; private set; }
        public bool IsActive => RevokedAt is null;

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (UserId == Guid.Empty)
                    response.AddErrorMessage(nameof(UserId), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(UserId)));

                if (string.IsNullOrWhiteSpace(Token))
                    response.AddErrorMessage(nameof(Token), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Token)));
                else if (Token.Length > TokenMaxLength)
                    response.AddErrorMessage(nameof(Token), string.Format(ValidationMessages.PropertyMaxLength, nameof(Token), TokenMaxLength));

                if (DeviceName != null && DeviceName.Length > DeviceNameMaxLength)
                    response.AddErrorMessage(nameof(DeviceName), string.Format(ValidationMessages.PropertyMaxLength, nameof(DeviceName), DeviceNameMaxLength));

                return response;
            }
        }

        public void SetUserId(Guid userId) => UserId = userId;

        public void SetToken(string token) => Token = token?.Trim() ?? string.Empty;

        public void SetDeviceName(string? deviceName) => DeviceName = deviceName?.Trim();

        public void Revoke(DateTime utcNow) => RevokedAt = utcNow;

        public void Activate() => RevokedAt = null;
    }
}
