using System.Diagnostics;
using System.Net;
using System.Text.Json;
using EasyFinance.Infrastructure;

namespace EasyFinance.Server.Middleware
{

    public class ExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IHostEnvironment _environment;
        private readonly ILogger<ExceptionMiddleware> _logger;

        public ExceptionMiddleware(
            RequestDelegate next,
            IHostEnvironment environment,
            ILogger<ExceptionMiddleware> logger)
        {
            _next = next;
            _environment = environment;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext httpContext)
        {
            try
            {
                await _next(httpContext);
            }
            catch (Exception ex)
            {
                var sanitizedPath = httpContext.Request.Path.Value?.Replace(Environment.NewLine, "").Replace("\n", "").Replace("\r", "");
                _logger.LogError(ex, "Unhandled exception occurred while processing request {Path}", sanitizedPath);
                await HandleExceptionAsync(httpContext, ex);
            }
        }

        private async Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            context.Response.ContentType = "application/json";

            var statusCode = GetStatusCode(exception);
            var errorDetails = GetErrorDetails(exception, statusCode);

            context.Response.StatusCode = statusCode;

            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var json = JsonSerializer.Serialize(errorDetails, options);
            await context.Response.WriteAsync(json);
        }

        private object GetErrorDetails(Exception exception, int statusCode)
        {
            if (_environment.IsDevelopment())
            {
                return new
                {
                    StatusCode = statusCode,
                    Message = exception.Message,
                    Type = exception.GetType().Name,
                    StackTrace = exception.StackTrace,
                    TraceId = Activity.Current?.Id ?? Guid.NewGuid().ToString(),
                    Path = Activity.Current?.OperationName,
                    Timestamp = DateTime.UtcNow
                };
            }

            return new
            {
                StatusCode = statusCode,
                Message = GetUserFriendlyMessage(exception),
                TraceId = Activity.Current?.Id ?? Guid.NewGuid().ToString(),
                Timestamp = DateTime.UtcNow
            };
        }

        private static int GetStatusCode(Exception exception) => exception switch
        {
            ArgumentException => (int)HttpStatusCode.BadRequest,
            UnauthorizedAccessException => (int)HttpStatusCode.Unauthorized,
            KeyNotFoundException => (int)HttpStatusCode.NotFound,
            _ => (int)HttpStatusCode.InternalServerError
        };

        private static string GetUserFriendlyMessage(Exception exception) => exception switch
        {
            ArgumentException => ValidationMessages.InvalidData,
            UnauthorizedAccessException => ValidationMessages.YouDontHavePermission,
            KeyNotFoundException => ValidationMessages.ResourceNotFound,
            _ => ValidationMessages.GenericError
        };
    }

    public static class ExceptionMiddlewareExtensions
    {
        public static IApplicationBuilder UseCustomExceptionHandler(
            this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<ExceptionMiddleware>();
        }
    }
}