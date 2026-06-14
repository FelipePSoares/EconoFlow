using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;

namespace EasyFinance.Application.Features.NotificationMessageResolver
{
    public partial class NotificationMessageResolver : INotificationMessageResolver
    {
        private static readonly JsonSerializerOptions metadataOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        public string ResolveBody(Notification notification)
        {
            var culture = notification.User?.Culture ?? CultureInfo.InvariantCulture;
            var template = NotificationMessages.ResourceManager.GetString(notification.CodeMessage, culture);

            if (string.IsNullOrWhiteSpace(template))
                return notification.CodeMessage;

            var metadata = ParseMetadata(notification.Metadata);
            if (metadata == null)
                return template;

            return PlaceholderPattern().Replace(template, match =>
            {
                var key = match.Groups[1].Value;
                var value = ResolveMetadataValue(metadata, key, culture);
                return value ?? match.Value;
            });
        }

        private static Dictionary<string, string>? ParseMetadata(string metadata)
        {
            if (string.IsNullOrWhiteSpace(metadata))
                return null;

            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, string>>(metadata, metadataOptions);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static string? ResolveMetadataValue(Dictionary<string, string> metadata, string key, CultureInfo culture)
        {
            var entry = metadata.FirstOrDefault(kvp =>
                string.Equals(kvp.Key, key, StringComparison.OrdinalIgnoreCase));

            if (entry.Equals(default(KeyValuePair<string, string>)))
                return null;

            var value = entry.Value?.Trim();
            if (string.IsNullOrWhiteSpace(value))
                return null;

            if (string.Equals(key, "Role", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<Role>(value, ignoreCase: true, out var role))
            {
                var roleKey = role switch
                {
                    Role.Viewer => nameof(NotificationMessages.NotificationRoleViewer),
                    Role.Manager => nameof(NotificationMessages.NotificationRoleManager),
                    Role.Admin => nameof(NotificationMessages.NotificationRoleAdmin),
                    _ => null
                };

                if (roleKey != null)
                {
                    var localized = NotificationMessages.ResourceManager.GetString(roleKey, culture);
                    if (!string.IsNullOrWhiteSpace(localized))
                        return localized;
                }
            }

            return value;
        }

        [GeneratedRegex(@"\{(\w+)\}", RegexOptions.Compiled)]
        private static partial Regex PlaceholderPattern();
    }
}
