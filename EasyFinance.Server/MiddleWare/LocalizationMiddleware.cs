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
            if (context.Request.Headers.AcceptLanguage.Count != 0)
            {
                foreach (var lang in context.Request.Headers.AcceptLanguage)
                {
                    var cultureCode = lang.Split(';')[0].Trim();

                    try
                    {
                        var culture = new CultureInfo(cultureCode);
                        CultureInfo.CurrentCulture = culture;
                        CultureInfo.CurrentUICulture = culture;
                        break; // Exit loop on first valid culture
                    }
                    catch (CultureNotFoundException)
                    {
                        continue;
                    }
                }
            } else {
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