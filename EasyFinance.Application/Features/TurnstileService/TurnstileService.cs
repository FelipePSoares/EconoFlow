using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Features.TurnstileService
{
    public class TurnstileService : ITurnstileService
    {
        private const string VerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

        private readonly HttpClient httpClient;
        private readonly TurnstileSettings settings;
        private readonly ILogger<TurnstileService> logger;

        public TurnstileService(HttpClient httpClient, IOptions<TurnstileSettings> settings, ILogger<TurnstileService> logger)
        {
            this.httpClient = httpClient;
            this.settings = settings.Value;
            this.logger = logger;
        }

        public bool IsEnabled()
        {
            return !string.IsNullOrWhiteSpace(settings.SecretKey);
        }

        public async Task<bool> ValidateTokenAsync(string token, CancellationToken cancellationToken = default)
        {
            if (!IsEnabled())
                return true;

            if (string.IsNullOrWhiteSpace(token))
            {
                logger.LogWarning("Turnstile token is missing or empty.");
                return false;
            }

            try
            {
                var content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    { "secret", settings.SecretKey },
                    { "response", token }
                });

                var response = await httpClient.PostAsync(VerifyUrl, content, cancellationToken);
                var responseBody = await response.Content.ReadAsStringAsync();

                var result = JsonSerializer.Deserialize<TurnstileVerifyResponse>(responseBody);

                if (result == null || !result.Success)
                {
                    logger.LogWarning("Turnstile validation failed. Errors: {Errors}", result?.ErrorCodes != null ? string.Join(", ", result.ErrorCodes) : "unknown");
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error occurred while validating Turnstile token.");
                return false;
            }
        }

        private class TurnstileVerifyResponse
        {
            [JsonPropertyName("success")]
            public bool Success { get; set; }

            [JsonPropertyName("error-codes")]
            public List<string> ErrorCodes { get; set; } = new List<string>();

            [JsonPropertyName("challenge_ts")]
            public string ChallengeTs { get; set; } = string.Empty;

            [JsonPropertyName("hostname")]
            public string Hostname { get; set; } = string.Empty;
        }
    }
}
