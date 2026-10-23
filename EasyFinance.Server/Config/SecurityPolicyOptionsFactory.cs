using FpsSoftware.Chassis;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;

namespace EasyFinance.Server.Config;

/// <summary>
/// Builds the <see cref="SecurityPolicyOptions"/> that power the SPA content-security
/// policy middleware. The CSP is the original, complete one (styles, fonts, images,
/// Cloudflare Turnstile, etc.) that the old app-local middleware applied, and the text
/// of <c>index.html</c> is resolved from the web root so the nonce placeholder is
/// substituted correctly.
/// </summary>
public static class SecurityPolicyOptionsFactory
{
    /// <summary>
    /// Content-Security-Policy served on every non-API, non-asset SPA route. The
    /// nonce placeholder is replaced by the middleware with a per-request value.
    /// </summary>
    /// <remarks>
    /// <c>connect-src</c> admits <c>/api/csp-report</c> explicitly because browsers POST
    /// Trusted Types violation reports to that endpoint and the fetch is itself subject
    /// to this policy. Without the entry, every report is blocked by the policy it
    /// describes.
    /// </remarks>
    public const string CspValue =
        "default-src 'self'; " +
        "script-src 'self' 'nonce-{{nonce}}' https://challenges.cloudflare.com; " +
        "style-src 'self' https://fonts.googleapis.com 'nonce-{{nonce}}'; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self' /api/csp-report https://econoflow.pt; " +
        "frame-src https://challenges.cloudflare.com; " +
        "frame-ancestors 'none'; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self';";

    /// <summary>
    /// Creates the default options for the deployed application, resolving the SPA
    /// index document from the content root file provider.
    /// </summary>
    public static SecurityPolicyOptions Create(IWebHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(environment);

        // Reading the index via the content root (…/wwwroot/index.html) matches the
        // original app-local middleware and lets the nonce placeholder be replaced.
        return new SecurityPolicyOptions
        {
            CspValue = CspValue,
            FileProvider = environment.ContentRootFileProvider,
        };
    }
}
