using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Features.ExpoPushTokenService
{
    public class ExpoPushClient(
        HttpClient httpClient,
        IOptions<ExpoPushOptions> options,
        ILogger<ExpoPushClient> logger) : IExpoPushClient
    {
        private static readonly JsonSerializerOptions SerializerOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        private const string ExpoPushUrl = "https://exp.host/--/api/v2/push/send";
        private const int BatchSize = 100;

        private readonly HttpClient httpClient = httpClient;
        private readonly ExpoPushOptions options = options.Value;
        private readonly ILogger<ExpoPushClient> logger = logger;

        public async Task<AppResponse> SendAsync(IEnumerable<ExpoMessage> messages, CancellationToken cancellationToken)
        {
            var messageList = messages.ToList();
            if (messageList.Count == 0)
                return AppResponse.Success();

            var batches = messageList
                .Select((m, i) => (m, i))
                .GroupBy(x => x.i / BatchSize)
                .Select(g => g.Select(x => x.m).ToList());

            var errors = new List<string>();

            foreach (var batch in batches)
            {
                var result = await SendBatchAsync(batch, cancellationToken);
                if (result.Failed)
                    errors.AddRange(result.Messages.Select(m => m.Description));
            }

            if (errors.Count > 0)
                return AppResponse.Error("expo-push-failed", string.Join("; ", errors));

            return AppResponse.Success();
        }

        private async Task<AppResponse> SendBatchAsync(List<ExpoMessage> batch, CancellationToken cancellationToken)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, ExpoPushUrl);
                request.Content = JsonContent.Create(batch, options: SerializerOptions);
                request.Headers.Add("Accept", "application/json");
                request.Headers.Add("Accept-Encoding", "gzip, deflate");

                if (!string.IsNullOrWhiteSpace(options.AccessToken))
                    request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", options.AccessToken);

                using var response = await httpClient.SendAsync(request, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync(cancellationToken);
                    logger.LogWarning("Expo push API returned {StatusCode}: {Body}", response.StatusCode, body);
                    return AppResponse.Error("expo-http-error", $"HTTP {(int)response.StatusCode}");
                }

                var result = await response.Content.ReadFromJsonAsync<ExpoPushResponse>(SerializerOptions, cancellationToken);
                if (result?.Data is not null)
                {
                    var failed = result.Data.Where(r => r.Status == "error").ToList();
                    if (failed.Count > 0)
                    {
                        var details = string.Join("; ", failed.Select(f => $"{f.Message} ({f.Details?.Error})"));
                        logger.LogWarning("Expo push delivery errors: {Details}", details);

                        if (failed.Any(f => f.Details?.Error == "DeviceNotRegistered"))
                            return AppResponse.Error("DeviceNotRegistered", details);

                        return AppResponse.Error("expo-push-failed", details);
                    }
                }

                return AppResponse.Success();
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Unexpected error sending Expo push notification batch");
                return AppResponse.Error("expo-push-exception", ex.Message);
            }
        }

        private sealed class ExpoPushResponse
        {
            public List<ExpoPushTicket>? Data { get; set; }
        }

        private sealed class ExpoPushTicket
        {
            public string Status { get; set; } = string.Empty;
            public string? Message { get; set; }
            public ExpoPushTicketDetails? Details { get; set; }
        }

        private sealed class ExpoPushTicketDetails
        {
            public string? Error { get; set; }
        }
    }

    public class ExpoPushOptions
    {
        public const string SectionName = "ExpoPush";
        public string? AccessToken { get; set; }
    }
}
