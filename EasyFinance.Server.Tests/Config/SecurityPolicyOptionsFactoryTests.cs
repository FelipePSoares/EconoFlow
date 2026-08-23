using EasyFinance.Server.Config;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
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
}
