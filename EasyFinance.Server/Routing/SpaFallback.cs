using System;
using System.Linq;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace EasyFinance.Server.Routing
{
    /// <summary>
    /// Hands client-side routes back to the SPA.
    ///
    /// <para>
    /// The Angular build is a prerender/SSR build: <c>angular.json</c> prerenders the routes in
    /// <c>src/prerender-routes.txt</c> and the image copies only <c>dist/…/browser/</c> into
    /// <c>wwwroot</c>. Everything else the router knows - a project, a category, an expense -
    /// is rendered from data at run time, so no file exists for it. Without a fallback
    /// <c>UseStaticFiles()</c> answers those paths with a 404, which means opening a project
    /// directly, or refreshing one, fails on anything that serves the built bundle.
    /// </para>
    ///
    /// <para>
    /// CI could not see it because the end-to-end suite runs against <c>ng serve</c>, which
    /// answers every path itself. It appeared as soon as the docker stack started and Cypress
    /// was pointed at it.
    /// </para>
    ///
    /// <para>
    /// The non-prerendered shell is <c>index.csr.html</c>: the same page as <c>index.html</c>
    /// without the prerendered home page markup, so the router renders the requested route
    /// instead of <c>/</c>.
    /// </para>
    ///
    /// <para>
    /// This is a middleware branch rather than <c>MapFallbackToFile</c>: that answers EVERY
    /// unmatched request, and a missing bundle answered with HTML turns a clear 404 into
    /// "unexpected token '&lt;'" in the browser. The predicate below is what keeps the fallback
    /// to pages.
    /// </para>
    /// </summary>
    public static class SpaFallback
    {
        /// <summary>
        /// The client-side shell, as the Angular build emits it next to the prerendered pages.
        /// </summary>
        public const string ClientShellPath = "/index.csr.html";

        /// <summary>
        /// The path prefix the API owns. Matched case-insensitively and as a whole segment, so
        /// <c>/api</c> and <c>/api/…</c> are the API while <c>/apix</c> is a page.
        /// </summary>
        public const string ApiPathPrefix = "/api";

        private static readonly string[] StaticExtensions =
        [
            ".js", ".mjs", ".css", ".map", ".json", ".webmanifest", ".txt", ".xml", ".ico", ".png",
            ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".woff", ".woff2", ".ttf", ".eot",
            ".wasm", ".csv", ".pdf"
        ];

        /// <summary>
        /// Whether a request is a page the SPA's router owns, and so should be answered with the
        /// shell when no file matches it.
        ///
        /// <para>
        /// Deliberately narrow: only <c>GET</c>/<c>HEAD</c> (a write must never be answered with
        /// HTML), never the API's namespace, and never a path that looks like a file - a missing
        /// hashed bundle has to stay a 404, or the browser parses HTML as JavaScript and the page
        /// goes blank instead of failing loudly.
        /// </para>
        /// </summary>
        public static bool IsClientRoute(PathString path, string method)
        {
            if (!HttpMethods.IsGet(method) && !HttpMethods.IsHead(method))
            {
                return false;
            }

            var value = path.Value ?? string.Empty;

            if (IsApiPath(value))
            {
                return false;
            }

            // The last segment decides: `/assets/logo.png` is a file, `/projects/1/expenses` is a
            // route. A trailing slash is a directory-style page, so it stays a client route.
            var lastSegment = value
                .TrimEnd('/')
                .Split('/', StringSplitOptions.RemoveEmptyEntries)
                .LastOrDefault() ?? string.Empty;

            return !StaticExtensions.Any(extension => lastSegment.EndsWith(extension, StringComparison.OrdinalIgnoreCase));
        }

        private static bool IsApiPath(string value) =>
            value.Equals(ApiPathPrefix, StringComparison.OrdinalIgnoreCase)
            || value.StartsWith(ApiPathPrefix + "/", StringComparison.OrdinalIgnoreCase);

        /// <summary>
        /// Adds the fallback branch to the pipeline.
        ///
        /// <para>
        /// <b>Call it after <c>MapControllers()</c>.</b> Everything registered before it - the
        /// static files, the health probes, the controllers - has already answered what it owns;
        /// only an unmatched page reaches this branch, which then serves the shell from
        /// <c>wwwroot</c>.
        /// </para>
        /// </summary>
        public static IApplicationBuilder UseSpaFallback(this IApplicationBuilder app)
        {
            ArgumentNullException.ThrowIfNull(app);

            return app.MapWhen(
                context => IsClientRoute(context.Request.Path, context.Request.Method),
                spa =>
                {
                    spa.Use(async (context, next) =>
                    {
                        // Rewrite, do not redirect: the address bar keeps the route the user
                        // asked for, which is what the router needs in order to render it.
                        context.Request.PathBase = context.Request.PathBase.Add(context.Request.Path);
                        context.Request.Path = ClientShellPath;

                        await next();
                    });

                    // Serves the rewritten request from wwwroot. If the shell is not there (an
                    // image built without the SPA) the request falls through and fails as it did
                    // before, rather than being answered with an empty 200.
                    spa.UseStaticFiles();
                });
        }
    }
}
