using EasyFinance.Server.Config;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.FileProviders.Physical;
using Moq;

namespace EasyFinance.Server.Tests.Config;

public class SecurityPolicyOptionsFactoryTests
{
    [Fact]
    public void Create_ShouldSetFullCsp()
    {
        var environment = Mock.Of<IWebHostEnvironment>();

        var options = SecurityPolicyOptionsFactory.Create(environment);

        options.CspValue.Should().Contain("default-src 'self'");
        options.CspValue.Should().Contain("'nonce-{{nonce}}'");
        options.CspValue.Should().Contain("https://challenges.cloudflare.com");
        options.CspValue.Should().Contain("https://fonts.googleapis.com");
        options.CspValue.Should().Contain("https://fonts.gstatic.com");
        options.CspValue.Should().Contain("frame-ancestors 'none'");
        options.CspValue.Should().Contain("object-src 'none'");
        options.CspValue.Should().Contain("{{nonce}}");
    }

    [Fact]
    public void Create_ShouldAllowBrowserTrustedTypesReportingEndpoint()
    {
        // Browsers POST Trusted Types violation reports to a fixed endpoint
        // (`trusted-types-report-to` on the policy). The SPA reads it back at
        // /api/csp-report, so connect-src has to admit that same-origin path or
        // every report is silently blocked by the very policy it describes.
        var environment = Mock.Of<IWebHostEnvironment>();

        var options = SecurityPolicyOptionsFactory.Create(environment);

        options.CspValue.Should().Contain("connect-src 'self' /api/csp-report");
    }

    [Fact]
    public void Create_ShouldResolveIndexFromContentRoot()
    {
        // Web host environment whose content root contains the published SPA at
        // wwwroot/index.html (the same layout the runtime Docker image produces).
        var contentRoot = Path.Combine(Path.GetTempPath(), "EconoFlow-SecurityPolicy-Tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(contentRoot, "wwwroot"));
        var indexHtml = Path.Combine(contentRoot, "wwwroot", "index.html");
        File.WriteAllText(indexHtml, "<html data-nonce=\"{{nonce}}\"></html>");

        try
        {
            var environment = new Mock<IWebHostEnvironment>();
            environment.Setup(e => e.ContentRootFileProvider)
                       .Returns(new PhysicalFileProvider(contentRoot));

            var options = SecurityPolicyOptionsFactory.Create(environment.Object);

            options.FileProvider.Should().NotBeNull();
            var file = options.FileProvider!.GetFileInfo("wwwroot/index.html");
            file.Exists.Should().BeTrue();
        }
        finally
        {
            Directory.Delete(contentRoot, recursive: true);
        }
    }

    [Fact]
    public void DevServer_ShouldServeTheSameCspAsProduction()
    {
        // Development mode skips UseSecurityPolicy, so the only thing that keeps
        // CSP regressions visible during local development and in the Cypress
        // suite is the Angular dev-server proxy emitting the same header. The
        // two definitions drift apart easily, so they are compared here.
        var proxyConfigPath = FindClientFile("proxy.conf.js");

        proxyConfigPath.Should().NotBeNull("the Angular dev-server proxy config must exist so it can carry the CSP");
        var proxyConfig = File.ReadAllText(proxyConfigPath!);

        var devServerPolicy = ExtractDevServerCsp(proxyConfig);

        devServerPolicy.Should().NotBeNull("src/proxy.conf.js must publish a Content-Security-Policy header for the dev server");

        // The dev server substitutes a per-request nonce of its own, and allows the
        // Angular live-reload websocket, so the two policies are compared on the
        // directives that must be identical between development and production.
        foreach (var directive in new[]
                 {
                     "default-src 'self'",
                     "frame-ancestors 'none'",
                     "object-src 'none'",
                     "base-uri 'self'",
                     "form-action 'self'",
                     "img-src 'self' data:",
                 })
        {
            SecurityPolicyOptionsFactory.CspValue.Should().Contain(directive);
            devServerPolicy.Should().Contain(directive);
        }

        devServerPolicy.Should().Contain("https://challenges.cloudflare.com");
        devServerPolicy.Should().Contain("https://fonts.googleapis.com");
        devServerPolicy.Should().Contain("https://fonts.gstatic.com");
    }

    /// <summary>
    /// Pulls the Content-Security-Policy value out of the dev-server proxy config.
    /// The config is plain CommonJS, so the value is matched textually rather than
    /// executed. Both the object-literal style (`'Content-Security-Policy': value`) and
    /// the setHeader style (`setHeader('Content-Security-Policy', value)`) are accepted.
    /// </summary>
    private static string? ExtractDevServerCsp(string proxyConfig)
    {
        const System.Text.RegularExpressions.RegexOptions Options =
            System.Text.RegularExpressions.RegexOptions.Singleline;

        var setHeaderMatch = System.Text.RegularExpressions.Regex.Match(
            proxyConfig,
            @"setHeader\(\s*['""]Content-Security-Policy['""]\s*,\s*(?<value>\w+)\s*\)",
            Options);

        if (setHeaderMatch.Success)
            return ResolveConstant(proxyConfig, setHeaderMatch.Groups["value"].Value);

        var objectLiteralMatch = System.Text.RegularExpressions.Regex.Match(
            proxyConfig,
            @"['""]Content-Security-Policy['""]\s*:\s*(?<value>['""].*?['""]|[\w.]+)\s*[,}]",
            Options);

        if (!objectLiteralMatch.Success)
            return null;

        var rawValue = objectLiteralMatch.Groups["value"].Value;

        return rawValue.StartsWith('\'') || rawValue.StartsWith('"')
            ? rawValue
            : ResolveConstant(proxyConfig, rawValue);
    }

    /// <summary>
    /// Follows a `const NAME = [ ... ].join('; ')` declaration so the assertion compares
    /// the assembled policy rather than the variable name.
    /// </summary>
    private static string? ResolveConstant(string proxyConfig, string constantName)
    {
        var declaration = System.Text.RegularExpressions.Regex.Match(
            proxyConfig,
            @"const\s+" + System.Text.RegularExpressions.Regex.Escape(constantName) + @"\s*=\s*\[(?<body>.*?)\]\s*\.join\(\s*(?<separator>['""][^'""]*['""])\s*\)",
            System.Text.RegularExpressions.RegexOptions.Singleline);

        if (!declaration.Success)
            return null;

        var separator = declaration.Groups["separator"].Value.Trim('\'', '"');
        var directives = declaration.Groups["body"].Value
            .Split('\n')
            .Select(line => line.Trim())
            .Where(line => line.StartsWith('\'') || line.StartsWith('"'))
            .Select(line => line.TrimStart('\'', '"'))
            .Select(line => line.Substring(0, line.LastIndexOfAny(new[] { '\'', '"' })))
            .ToList();

        return string.Join(separator, directives);
    }

    /// <summary>
    /// Walks up from the test assembly to the repository root, then down into the
    /// Angular client. Test output lives under bin/&lt;config&gt;/&lt;tfm&gt;.
    /// </summary>
    private static string? FindClientFile(string relativePath)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, "easyfinance.client", "src", relativePath);
            if (File.Exists(candidate))
                return candidate;

            directory = directory.Parent;
        }

        return null;
    }
}
