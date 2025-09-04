namespace EasyFinance.Server.MiddleWare
{
    public static class SafeHeadersMiddleware
    {
        public static IApplicationBuilder UseSafeHeaders(this IApplicationBuilder builder)
        {
            return builder.Use(async (context, next) =>
            {
                context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
                context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
                await next();
            });
        }
    }
}