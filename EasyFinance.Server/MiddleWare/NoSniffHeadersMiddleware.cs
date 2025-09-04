namespace EasyFinance.Server.MiddleWare
{
    public static class NoSniffHeadersMiddleware
    {
        public static IApplicationBuilder UseNoSniffHeaders(this IApplicationBuilder builder)
        {
            return builder.Use(async (context, next) =>
            {
                context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
                await next();
            });
        }
    }
}