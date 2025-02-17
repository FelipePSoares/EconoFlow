using System.Net;
using System.Text.Json;
using EasyFinance.Infrastructure.Exceptions;
using Serilog;

namespace EasyFinance.Server.Middleware
{
    public class ExceptionMiddleware
    {
        private readonly RequestDelegate next;
        private readonly IHostEnvironment environment;

        public ExceptionMiddleware(RequestDelegate next, IHostEnvironment environment)
        {
            this.next = next;
            this.environment = environment;
        }

        public async Task InvokeAsync(HttpContext httpContext)
        {
            try
            {
                await next(httpContext);
            }
            catch (ValidationException ex)
            {
                Log.Error(ex, ex.Message);

                await HandleValidationExceptionAsync(httpContext, ex);
            }
            catch (Exception ex)
            {
                Log.Error(ex, ex.Message);

                await HandleExceptionAsync(httpContext, ex);
            }
        }

        private async Task HandleValidationExceptionAsync(HttpContext httpContext, ValidationException ex)
        {
            httpContext.Response.ContentType = "application/json";
            httpContext.Response.StatusCode = (int)HttpStatusCode.BadRequest;

            var response = new
            {
                Errors = new Dictionary<string, string>
                {
                    { ex.Property, ex.Message }
                }
            };

            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            var json = JsonSerializer.Serialize(response, options);

            await httpContext.Response.WriteAsync(json);
        }

        private async Task HandleExceptionAsync(HttpContext httpContext, Exception ex)
        {
            httpContext.Response.ContentType = "application/json";
            httpContext.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var response = new
            {
                Message = ex.Message,
                StackTrace = this.environment.IsDevelopment() ? ex.StackTrace?.ToString() : "Internal Server Error"
            };

            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            var json = JsonSerializer.Serialize(response, options);

            await httpContext.Response.WriteAsync(json);
        }
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
