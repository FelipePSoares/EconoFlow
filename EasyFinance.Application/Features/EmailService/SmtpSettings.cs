using System;
using System.Globalization;
using System.Linq;
using FpsSoftware.Chassis;
using MailKit.Security;
using Microsoft.Extensions.Configuration;

namespace EasyFinance.Application.Features.EmailService
{
    /// <summary>
    /// SMTP configuration for outbound e-mail. Every value can be supplied either
    /// through the <c>Smtp</c> configuration section or through the matching
    /// environment variable, which wins. Environment variables are the intended
    /// configuration channel when the application runs on Kubernetes.
    /// </summary>
    public class SmtpSettings
    {
        public const string SectionName = "Smtp";

        public const string HostEnvironmentVariable = "SMTP_HOST";
        public const string PortEnvironmentVariable = "SMTP_PORT";
        public const string UsernameEnvironmentVariable = "SMTP_USERNAME";
        public const string PasswordEnvironmentVariable = "SMTP_PASSWORD";
        public const string SecureSocketEnvironmentVariable = "SMTP_SECURE_SOCKET";
        public const string FromAddressEnvironmentVariable = "SMTP_FROM_ADDRESS";
        public const string FromNameEnvironmentVariable = "SMTP_FROM_NAME";
        public const string TimeoutSecondsEnvironmentVariable = "SMTP_TIMEOUT_SECONDS";

        public const int DefaultPort = 587;
        public const string DefaultSecureSocket = "Auto";
        public const string DefaultFromAddress = "noreply@econoflow.pt";
        public const string DefaultFromName = "NoReply EconoFlow";
        public const int DefaultTimeoutSeconds = 30;

        private const int MaxPort = 65535;

        private static readonly SecureSocketOptions[] SupportedSecureSockets =
        [
            SecureSocketOptions.Auto,
            SecureSocketOptions.None,
            SecureSocketOptions.StartTls,
            SecureSocketOptions.SslOnConnect
        ];

        /// <summary>SMTP server host name (no scheme, no port).</summary>
        public string Host { get; set; } = string.Empty;

        /// <summary>SMTP server port. 587 (submission/STARTTLS) by default, 465 for implicit TLS.</summary>
        public int Port { get; set; } = DefaultPort;

        /// <summary>SMTP authentication user.</summary>
        public string Username { get; set; } = string.Empty;

        /// <summary>SMTP authentication password.</summary>
        public string Password { get; set; } = string.Empty;

        /// <summary>One of <c>Auto</c>, <c>None</c>, <c>StartTls</c> or <c>SslOnConnect</c>.</summary>
        public string SecureSocket { get; set; } = DefaultSecureSocket;

        /// <summary>Envelope/header sender address used for every outbound e-mail.</summary>
        public string FromAddress { get; set; } = DefaultFromAddress;

        /// <summary>Display name used next to <see cref="FromAddress"/>.</summary>
        public string FromName { get; set; } = DefaultFromName;

        /// <summary>Timeout, in seconds, applied to SMTP connect, authenticate and send operations.</summary>
        public int TimeoutSeconds { get; set; } = DefaultTimeoutSeconds;

        /// <summary>
        /// Builds the settings from the <c>Smtp</c> configuration section and then
        /// applies the environment variable overrides on top of it. Values that are
        /// absent or blank in the environment keep the configuration value.
        /// </summary>
        /// <exception cref="InvalidOperationException">
        /// Thrown when a numeric environment variable is present but is not a valid integer.
        /// </exception>
        public static SmtpSettings Resolve(IConfiguration configuration, Func<string, string?> environmentReader)
        {
            ArgumentNullException.ThrowIfNull(environmentReader);

            var settings = configuration?.GetSection(SectionName).Get<SmtpSettings>() ?? new SmtpSettings();

            settings.Host = Override(environmentReader(HostEnvironmentVariable), settings.Host);
            settings.Username = Override(environmentReader(UsernameEnvironmentVariable), settings.Username);
            settings.Password = OverrideSecret(environmentReader(PasswordEnvironmentVariable), settings.Password);
            settings.SecureSocket = Override(environmentReader(SecureSocketEnvironmentVariable), settings.SecureSocket);
            settings.FromAddress = Override(environmentReader(FromAddressEnvironmentVariable), settings.FromAddress);
            settings.FromName = Override(environmentReader(FromNameEnvironmentVariable), settings.FromName);
            settings.Port = OverrideInt(environmentReader(PortEnvironmentVariable), settings.Port, PortEnvironmentVariable);
            settings.TimeoutSeconds = OverrideInt(environmentReader(TimeoutSecondsEnvironmentVariable), settings.TimeoutSeconds, TimeoutSecondsEnvironmentVariable);

            return settings;
        }

        /// <summary>
        /// Self-validation of the settings. Returns a failed response listing every
        /// missing or invalid value together with the environment variable that
        /// supplies it, so a misconfigured deployment fails fast with an actionable
        /// message.
        /// </summary>
        public AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (string.IsNullOrWhiteSpace(Host))
                    response.AddErrorMessage(nameof(Host), $"SMTP host is required (set {HostEnvironmentVariable}).");

                if (string.IsNullOrWhiteSpace(Username))
                    response.AddErrorMessage(nameof(Username), $"SMTP username is required (set {UsernameEnvironmentVariable}).");

                if (string.IsNullOrWhiteSpace(Password))
                    response.AddErrorMessage(nameof(Password), $"SMTP password is required (set {PasswordEnvironmentVariable}).");

                if (string.IsNullOrWhiteSpace(FromAddress))
                    response.AddErrorMessage(nameof(FromAddress), $"SMTP from address is required (set {FromAddressEnvironmentVariable}).");

                if (Port <= 0 || Port > MaxPort)
                    response.AddErrorMessage(nameof(Port), $"SMTP port must be between 1 and {MaxPort} (set {PortEnvironmentVariable}).");

                if (TimeoutSeconds <= 0)
                    response.AddErrorMessage(nameof(TimeoutSeconds), $"SMTP timeout must be greater than zero seconds (set {TimeoutSecondsEnvironmentVariable}).");

                if (!TryParseSecureSocket(SecureSocket, out _))
                    response.AddErrorMessage(nameof(SecureSocket), $"SMTP secure socket must be one of {string.Join(", ", SupportedSecureSockets)} (set {SecureSocketEnvironmentVariable}).");

                return response;
            }
        }

        /// <summary>Maps <see cref="SecureSocket"/> onto the MailKit socket options.</summary>
        public bool TryGetSecureSocketOptions(out SecureSocketOptions secureSocketOptions)
            => TryParseSecureSocket(SecureSocket, out secureSocketOptions);

        private static bool TryParseSecureSocket(string secureSocket, out SecureSocketOptions secureSocketOptions)
            => Enum.TryParse(secureSocket, ignoreCase: true, out secureSocketOptions)
               && SupportedSecureSockets.Contains(secureSocketOptions);

        private static string Override(string? environmentValue, string currentValue)
            => string.IsNullOrWhiteSpace(environmentValue) ? currentValue : environmentValue.Trim();

        private static string OverrideSecret(string? environmentValue, string currentValue)
            => string.IsNullOrEmpty(environmentValue) ? currentValue : environmentValue;

        private static int OverrideInt(string? environmentValue, int currentValue, string variableName)
        {
            if (string.IsNullOrWhiteSpace(environmentValue))
                return currentValue;

            if (!int.TryParse(environmentValue.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedValue))
                throw new InvalidOperationException($"The {variableName} environment variable must be a valid integer but was '{environmentValue}'.");

            return parsedValue;
        }
    }
}
