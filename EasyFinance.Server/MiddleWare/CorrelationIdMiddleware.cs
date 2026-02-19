using Serilog;

namespace EasyFinance.Server.MiddleWare
{
    public class CorrelationIdMiddleware(RequestDelegate next, IDiagnosticContext diagnosticContext)
    {
        private readonly string correlationIdClaimType = "CorrelationId";
        private readonly string correlationIdHeaderName = "X-Correlation-Id";
        private readonly RequestDelegate _next = next;
        private readonly IDiagnosticContext _diagnosticContext = diagnosticContext;

        public async Task Invoke(HttpContext context)
        {
            var correlationId = context.User.Claims
                .FirstOrDefault(c => c.Type == correlationIdClaimType)?.Value;

            if (string.IsNullOrEmpty(correlationId))
            {
                if (TryGetValidatedCorrelationIdFromHeader(context, out var headerCorrelationId))
                {
                    correlationId = headerCorrelationId;
                }
            }

            if (string.IsNullOrEmpty(correlationId))
            {
                correlationId = context.TraceIdentifier;
            }

            if (string.IsNullOrEmpty(correlationId))
            {
                correlationId = Guid.NewGuid().ToString();
            }

            context.Request.Headers[correlationIdHeaderName] = correlationId;
            context.Response.Headers[correlationIdHeaderName] = correlationId;
            context.Items[correlationIdClaimType] = correlationId;
            _diagnosticContext.Set(correlationIdClaimType, correlationId);

            using (Serilog.Context.LogContext.PushProperty(correlationIdClaimType, correlationId))
            {
                await _next(context);
            }
        }

        private bool TryGetValidatedCorrelationIdFromHeader(HttpContext context, out string correlationId)
        {
            correlationId = null;
            var headerValue = context.Request.Headers[correlationIdHeaderName].FirstOrDefault();

            if (string.IsNullOrWhiteSpace(headerValue))
            {
                return false;
            }

            if (headerValue.Length > 64)
            {
                return false;
            }

            if (!Guid.TryParse(headerValue, out var parsedGuid))
            {
                return false;
            }

            correlationId = parsedGuid.ToString();
            return true;
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
