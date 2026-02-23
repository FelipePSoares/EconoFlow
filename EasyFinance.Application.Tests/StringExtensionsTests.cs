using EasyFinance.Infrastructure.Extensions;
using FluentAssertions;

namespace EasyFinance.Application.Tests
{
    public class StringExtensionsTests
    {
        [Fact]
        public void ReplaceTokens_ShouldReplaceUsingPlainTokenName()
        {
            var template = "Hello {{firstName}}!";
            var result = template.ReplaceTokens([("firstName", "Felipe")]);

            result.Should().Be("Hello Felipe!");
        }

        [Fact]
        public void ReplaceTokens_ShouldReplaceWhenTokenComesWrapped()
        {
            var template = "Open {{callbackUrl}}";
            var result = template.ReplaceTokens([("{{callbackUrl}}", "https://econoflow.pt")]);

            result.Should().Be("Open https://econoflow.pt");
        }
    }
}
