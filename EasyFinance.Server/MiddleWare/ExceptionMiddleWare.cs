using System.Net;
using System.Text.Json;
using EasyFinance.Infrastructure.Exceptions;
using Serilog;

namespace EasyFinance.Server.Middleware
{
    public class ExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IHostEnvironment _environment;

        public ExceptionMiddleware(RequestDelegate next, IHostEnvironment environment)
        {
            _next = next;
            _environment = environment;
        }

        public async Task InvokeAsync(HttpContext httpContext)
        {
            try
            {
                await _next(httpContext);
            }
            catch (ForbiddenException ex)
            {
                Log.Error(ex, ex.Message);

                httpContext.Response.StatusCode = (int)HttpStatusCode.Forbidden;
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
                Property = ex.Property,
                Message = ex.Message,
                StackTrace = _environment.IsDevelopment() ? ex.StackTrace?.ToString() : "Internal Server Error"
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
                StackTrace = _environment.IsDevelopment() ? ex.StackTrace?.ToString() : "Internal Server Error"
            };

            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            var json = JsonSerializer.Serialize(response, options);

            await httpContext.Response.WriteAsync(json);
        }
    }
}
