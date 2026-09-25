using System;
using System.Linq;
using EasyFinance.Application.Features.EmailService;
using FluentAssertions;
using MailKit.Security;
using Microsoft.Extensions.Configuration;

namespace EasyFinance.Application.Tests.Features.EmailService
{
    public class SmtpSettingsTests
    {
        [Fact]
        public void Defaults_ShouldMatchDocumentedDefaults()
        {
            var settings = new SmtpSettings();

            settings.Host.Should().BeEmpty();
            settings.Port.Should().Be(587);
            settings.Username.Should().BeEmpty();
            settings.Password.Should().BeEmpty();
            settings.SecureSocket.Should().Be(SmtpSettings.DefaultSecureSocket);
            settings.FromAddress.Should().Be(SmtpSettings.DefaultFromAddress);
            settings.FromName.Should().Be(SmtpSettings.DefaultFromName);
            settings.TimeoutSeconds.Should().Be(SmtpSettings.DefaultTimeoutSeconds);
        }

        [Fact]
        public void Resolve_WithNoConfiguration_ShouldKeepDefaults()
        {
            var settings = SmtpSettings.Resolve(Configuration(), Environment());

            settings.Host.Should().BeEmpty();
            settings.Port.Should().Be(587);
        }

        [Fact]
        public void Resolve_WithAppSettingsSection_ShouldReadAllValues()
        {
            var configuration = Configuration(
                ("Smtp:Host", "smtp.config.local"),
                ("Smtp:Port", "2525"),
                ("Smtp:Username", "config-user"),
                ("Smtp:Password", "config-password"),
                ("Smtp:SecureSocket", "SslOnConnect"),
                ("Smtp:FromAddress", "config@econoflow.pt"),
                ("Smtp:FromName", "Config Sender"),
                ("Smtp:TimeoutSeconds", "15"));

            var settings = SmtpSettings.Resolve(configuration, Environment());

            settings.Host.Should().Be("smtp.config.local");
            settings.Port.Should().Be(2525);
            settings.Username.Should().Be("config-user");
            settings.Password.Should().Be("config-password");
            settings.SecureSocket.Should().Be("SslOnConnect");
            settings.FromAddress.Should().Be("config@econoflow.pt");
            settings.FromName.Should().Be("Config Sender");
            settings.TimeoutSeconds.Should().Be(15);
        }

        [Fact]
        public void Resolve_WithEnvironmentVariables_ShouldOverrideAppSettings()
        {
            var configuration = Configuration(
                ("Smtp:Host", "smtp.config.local"),
                ("Smtp:Port", "2525"),
                ("Smtp:Username", "config-user"),
                ("Smtp:Password", "config-password"),
                ("Smtp:SecureSocket", "SslOnConnect"),
                ("Smtp:FromAddress", "config@econoflow.pt"),
                ("Smtp:FromName", "Config Sender"),
                ("Smtp:TimeoutSeconds", "15"));

            var environment = Environment(
                ("SMTP_HOST", "smtp.env.local"),
                ("SMTP_PORT", "465"),
                ("SMTP_USERNAME", "env-user"),
                ("SMTP_PASSWORD", "env-password"),
                ("SMTP_SECURE_SOCKET", "StartTls"),
                ("SMTP_FROM_ADDRESS", "env@econoflow.pt"),
                ("SMTP_FROM_NAME", "Env Sender"),
                ("SMTP_TIMEOUT_SECONDS", "60"));

            var settings = SmtpSettings.Resolve(configuration, environment);

            settings.Host.Should().Be("smtp.env.local");
            settings.Port.Should().Be(465);
            settings.Username.Should().Be("env-user");
            settings.Password.Should().Be("env-password");
            settings.SecureSocket.Should().Be("StartTls");
            settings.FromAddress.Should().Be("env@econoflow.pt");
            settings.FromName.Should().Be("Env Sender");
            settings.TimeoutSeconds.Should().Be(60);
        }

        [Fact]
        public void Resolve_WithAbsentOrBlankEnvironmentVariables_ShouldKeepAppSettingsValues()
        {
            var configuration = Configuration(
                ("Smtp:Host", "smtp.config.local"),
                ("Smtp:Port", "2525"));

            var environment = Environment(
                ("SMTP_HOST", string.Empty),
                ("SMTP_PORT", "  "));

            var settings = SmtpSettings.Resolve(configuration, environment);

            settings.Host.Should().Be("smtp.config.local");
            settings.Port.Should().Be(2525);
        }

        [Theory]
        [InlineData("SMTP_PORT", "not-a-number")]
        [InlineData("SMTP_TIMEOUT_SECONDS", "10.5")]
        public void Resolve_WithUnparseableNumericEnvironmentVariable_ShouldThrow(string variable, string value)
        {
            var act = () => SmtpSettings.Resolve(Configuration(), Environment((variable, value)));

            act.Should().Throw<InvalidOperationException>().WithMessage($"*{variable}*");
        }

        [Fact]
        public void Validate_WhenHostIsMissing_ShouldReturnError()
        {
            var response = SmtpSettings.Resolve(Configuration(), Environment()).Validate;

            response.Failed.Should().BeTrue();
            response.Messages.Should().Contain(message => message.Description.Contains("SMTP_HOST", StringComparison.Ordinal));
        }

        [Theory]
        [InlineData("", "password", "SMTP_USERNAME")]
        [InlineData("username", "", "SMTP_PASSWORD")]
        public void Validate_WhenCredentialsAreIncomplete_ShouldReturnError(string username, string password, string expectedVariable)
        {
            var settings = new SmtpSettings { Host = "smtp.local", Username = username, Password = password };

            var response = settings.Validate;

            response.Failed.Should().BeTrue();
            response.Messages.Should().Contain(message => message.Description.Contains(expectedVariable, StringComparison.Ordinal));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        [InlineData(70000)]
        public void Validate_WhenPortIsOutOfRange_ShouldReturnError(int port)
        {
            var settings = ValidSettings();
            settings.Port = port;

            var response = settings.Validate;

            response.Failed.Should().BeTrue();
            response.Messages.Should().Contain(message => message.Description.Contains("SMTP_PORT", StringComparison.Ordinal));
        }

        [Fact]
        public void Validate_WhenSecureSocketIsUnknown_ShouldReturnError()
        {
            var settings = ValidSettings();
            settings.SecureSocket = "Sometimes";

            var response = settings.Validate;

            response.Failed.Should().BeTrue();
            response.Messages.Should().Contain(message => message.Description.Contains("SMTP_SECURE_SOCKET", StringComparison.Ordinal));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-30)]
        public void Validate_WhenTimeoutIsNotPositive_ShouldReturnError(int timeoutSeconds)
        {
            var settings = ValidSettings();
            settings.TimeoutSeconds = timeoutSeconds;

            var response = settings.Validate;

            response.Failed.Should().BeTrue();
            response.Messages.Should().Contain(message => message.Description.Contains("SMTP_TIMEOUT_SECONDS", StringComparison.Ordinal));
        }

        [Fact]
        public void Validate_WhenSecureSocketUsesDifferentCasing_ShouldSucceed()
        {
            var settings = ValidSettings();
            settings.SecureSocket = "starttls";

            settings.Validate.Succeeded.Should().BeTrue();
        }

        [Fact]
        public void Validate_WithCompleteSettings_ShouldSucceed()
        {
            ValidSettings().Validate.Succeeded.Should().BeTrue();
        }

        [Theory]
        [InlineData("Auto", SecureSocketOptions.Auto)]
        [InlineData("None", SecureSocketOptions.None)]
        [InlineData("StartTls", SecureSocketOptions.StartTls)]
        [InlineData("starttls", SecureSocketOptions.StartTls)]
        [InlineData("SslOnConnect", SecureSocketOptions.SslOnConnect)]
        public void TryGetSecureSocketOptions_WithSupportedValue_ShouldMapToTheMailKitOption(string value, SecureSocketOptions expected)
        {
            var settings = ValidSettings();
            settings.SecureSocket = value;

            settings.TryGetSecureSocketOptions(out var options).Should().BeTrue();
            options.Should().Be(expected);
        }

        [Theory]
        [InlineData("Sometimes")]
        [InlineData("StartTlsWhenAvailable")]
        [InlineData("")]
        public void TryGetSecureSocketOptions_WithUnsupportedValue_ShouldFail(string value)
        {
            var settings = ValidSettings();
            settings.SecureSocket = value;

            settings.TryGetSecureSocketOptions(out _).Should().BeFalse();
        }

        private static SmtpSettings ValidSettings() => new()
        {
            Host = "smtp.local",
            Port = 587,
            Username = "user",
            Password = "password",
            SecureSocket = SmtpSettings.DefaultSecureSocket,
            FromAddress = "noreply@econoflow.pt",
            FromName = "NoReply EconoFlow",
            TimeoutSeconds = 30,
        };

        private static IConfiguration Configuration(params (string key, string value)[] values)
        {
            var data = values.ToDictionary(value => value.key, value => (string?)value.value);
            return new ConfigurationBuilder().AddInMemoryCollection(data).Build();
        }

        private static Func<string, string?> Environment(params (string key, string value)[] values)
        {
            var data = values.ToDictionary(value => value.key, value => value.value);
            return name => data.TryGetValue(name, out var value) ? value : null;
        }
    }
}
