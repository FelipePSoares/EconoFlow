using System.Net;
using System.Net.Http;
using EasyFinance.Application.Features.TurnstileService;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;

namespace EasyFinance.Application.Tests
{
    public class TurnstileServiceTests
    {
        private readonly Mock<ILogger<TurnstileService>> loggerMock;

        public TurnstileServiceTests()
        {
            this.loggerMock = new Mock<ILogger<TurnstileService>>();
        }

        private TurnstileService CreateService(string secretKey, HttpMessageHandler handler)
        {
            var settings = Options.Create(new TurnstileSettings { SecretKey = secretKey });
            var httpClient = new HttpClient(handler);
            return new TurnstileService(httpClient, settings, loggerMock.Object);
        }

        private static Mock<HttpMessageHandler> CreateMockHandler(string responseContent, HttpStatusCode statusCode = HttpStatusCode.OK)
        {
            var handlerMock = new Mock<HttpMessageHandler>();
            handlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = statusCode,
                    Content = new StringContent(responseContent)
                });
            return handlerMock;
        }

        [Fact]
        public void IsEnabled_WhenSecretKeyIsSet_ReturnsTrue()
        {
            var handler = CreateMockHandler("{}");
            var service = CreateService("test-secret-key", handler.Object);

            Assert.True(service.IsEnabled());
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void IsEnabled_WhenSecretKeyIsEmpty_ReturnsFalse(string? secretKey)
        {
            var handler = CreateMockHandler("{}");
            var settings = Options.Create(new TurnstileSettings { SecretKey = secretKey ?? string.Empty });
            var httpClient = new HttpClient(handler.Object);
            var service = new TurnstileService(httpClient, settings, loggerMock.Object);

            Assert.False(service.IsEnabled());
        }

        [Fact]
        public async Task ValidateTokenAsync_WhenNotEnabled_ReturnsTrue()
        {
            var handler = CreateMockHandler("{}");
            var service = CreateService(string.Empty, handler.Object);

            var result = await service.ValidateTokenAsync("any-token");

            Assert.True(result);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task ValidateTokenAsync_WhenTokenIsEmpty_ReturnsFalse(string? token)
        {
            var handler = CreateMockHandler("{}");
            var service = CreateService("test-secret", handler.Object);

            var result = await service.ValidateTokenAsync(token!);

            Assert.False(result);
        }

        [Fact]
        public async Task ValidateTokenAsync_WhenCloudflareReturnsSuccess_ReturnsTrue()
        {
            var responseJson = "{\"success\": true, \"challenge_ts\": \"2024-01-01T00:00:00Z\", \"hostname\": \"example.com\"}";
            var handler = CreateMockHandler(responseJson);
            var service = CreateService("test-secret", handler.Object);

            var result = await service.ValidateTokenAsync("valid-token");

            Assert.True(result);
        }

        [Fact]
        public async Task ValidateTokenAsync_WhenCloudflareReturnsFailure_ReturnsFalse()
        {
            var responseJson = "{\"success\": false, \"error-codes\": [\"invalid-input-response\"]}";
            var handler = CreateMockHandler(responseJson);
            var service = CreateService("test-secret", handler.Object);

            var result = await service.ValidateTokenAsync("invalid-token");

            Assert.False(result);
        }

        [Fact]
        public async Task ValidateTokenAsync_WhenHttpRequestFails_ReturnsFalse()
        {
            var handlerMock = new Mock<HttpMessageHandler>();
            handlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ThrowsAsync(new HttpRequestException("Network error"));

            var service = CreateService("test-secret", handlerMock.Object);

            var result = await service.ValidateTokenAsync("any-token");

            Assert.False(result);
        }
    }
}
