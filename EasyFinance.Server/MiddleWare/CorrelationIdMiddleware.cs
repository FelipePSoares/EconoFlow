namespace EasyFinance.Server.MiddleWare
{
    public class CorrelationIdMiddleware(RequestDelegate next)
    {
        private readonly string correlationIdClaimType = "CorrelationId";
        private readonly RequestDelegate _next = next;

        public async Task Invoke(HttpContext context)
        {
            var correlationId = context.User.Claims
                .FirstOrDefault(c => c.Type == correlationIdClaimType)?.Value;

            if (string.IsNullOrEmpty(correlationId))
            {
                correlationId = Guid.NewGuid().ToString();
            }

            context.Items[correlationIdClaimType] = correlationId;

            using (Serilog.Context.LogContext.PushProperty(correlationIdClaimType, correlationId))
            {
                await _next(context);
            }
        }
    }

    public static class CorrelationIdMiddlewareExtensions
    {
        public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<CorrelationIdMiddleware>();
        }
    }
}
