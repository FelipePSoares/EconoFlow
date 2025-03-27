using System.Globalization;

namespace EasyFinance.Server.Middleware
{
    public class LocalizationMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<LocalizationMiddleware> _logger;

        public LocalizationMiddleware(RequestDelegate next, ILogger<LocalizationMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task Invoke(HttpContext context)
        {
            var userLanguage = context.Request.Headers["Accept-Language"].ToString();

            if (!string.IsNullOrWhiteSpace(userLanguage))
            {
                try
                {
                    var culture = new CultureInfo(userLanguage);
                    CultureInfo.CurrentCulture = culture;
                    CultureInfo.CurrentUICulture = culture;

                    _logger.LogInformation($"Language set to: {culture.Name}");
                }
                catch (CultureNotFoundException)
                {
                    _logger.LogWarning($"Language not found: {userLanguage}");
                }
            }
            else
            {
                _logger.LogInformation("No language identified, using default en-US.");
                CultureInfo.CurrentCulture = new CultureInfo("en-US");
                CultureInfo.CurrentUICulture = new CultureInfo("en-US");
            }

            await _next(context);
        }
    }

    public static class LocalizationMiddlewareExtensions
    {
        public static IApplicationBuilder UseLocationMiddleware(
            this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<LocalizationMiddleware>();
        }
    }
}