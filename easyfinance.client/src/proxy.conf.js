// Dev-server proxy configuration for `ng serve`.
//
// In Development the .NET host does not run its security-policy middleware (see
// Program.cs), so without a header here the Content-Security-Policy would never be
// exercised during local development or by the Cypress suite, which runs against this
// dev server.
//
// Keep this in sync with SecurityPolicyOptionsFactory.CspValue. The directives that must
// match between development and production are asserted by
// EasyFinance.Server.Tests/Config/SecurityPolicyOptionsFactoryTests.DevServer_ShouldServeTheSameCspAsProduction.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Angular's JIT compiler and the dev-server live-reload bootstrap need eval + inline.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data:",
  // ws: is required by the dev-server hot-reload socket.
  "connect-src 'self' ws: https://econoflow.pt",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const PROXY_CONFIG = [
  {
    context: [
      "/api",
    ],
    target: "https://localhost:7003",
    secure: false
  },
  {
    // Catch-all entry: the dev server writes its own responses (index.html, bundles),
    // so the header has to be attached when that response starts. Non-document requests
    // are passed straight through by the static handler and are unaffected.
    context: ["/"],
    target: "https://localhost:7003",
    secure: false,
    bypass: (req, res) => {
      res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      // Returning the URL hands the request back to the dev server's static handler
      // instead of proxying it to the API. Without this the shell would not be served.
      return req.url;
    }
  }
]

module.exports = PROXY_CONFIG;
