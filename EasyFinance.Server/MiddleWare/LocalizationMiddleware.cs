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
                var languages = userLanguage.Split(',');

                foreach (var lang in languages)
                {
                    var cultureCode = lang.Split(';')[0].Trim();

                    try
                    {
                        var culture = new CultureInfo(cultureCode);
                        CultureInfo.CurrentCulture = culture;
                        CultureInfo.CurrentUICulture = culture;

                        _logger.LogInformation($"Language set to: {culture.Name}");
                    }
                    catch (CultureNotFoundException)
                    {
                        var sanitizedCultureCode = cultureCode.Replace(Environment.NewLine, "").Replace("\n", "").Replace("\r", "");
                        _logger.LogWarning($"Language not found: {sanitizedCultureCode}");
                        continue;
                    }
                }
            } else {
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