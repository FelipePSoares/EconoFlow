using System.Security.Cryptography;

namespace EasyFinance.Server.MiddleWare
{
    public class SecurityPolicyMiddleware(RequestDelegate next)
    {
        private readonly RequestDelegate _next = next;

public async Task Invoke(HttpContext context)
{
    // Pass through API requests directly
    if (context.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase))
    {
        await _next(context);
        return;
    }

    // Pass through static assets (anything with a dot: .js, .css, .json, .png, etc.)
    if (Path.HasExtension(context.Request.Path))
    {
        await _next(context);
        return;
    }

    // Otherwise, it's an SPA route → serve index.html with CSP nonce
    var bytes = RandomNumberGenerator.GetBytes(16);
    var nonce = Convert.ToBase64String(bytes);
    context.Items["CSP-Nonce"] = nonce;

    var filePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "index.html");
    var html = await File.ReadAllTextAsync(filePath);

    html = html.Replace("{{nonce}}", nonce);

    context.Response.Headers.Append("Content-Security-Policy",
        "default-src 'self'; " +
        $"script-src 'self' 'nonce-{nonce}'; " +
        $"style-src 'self' https://fonts.googleapis.com 'nonce-{nonce}'; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self' https://econoflow.pt; " +
        "frame-ancestors 'none'; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self';");

    context.Response.ContentType = "text/html";
    await context.Response.WriteAsync(html);
}
    }

    public static class SecurityPolicyMiddlewareExtensions
    {
        public static IApplicationBuilder UseSecutiryPolicy(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<SecurityPolicyMiddleware>();
        }
    }
}
