using HtmlAgilityPack;

namespace EasyFinance.Infrastructure.Extensions
{
    public static class StringExtensions
    {
        public static string ReplaceTokens(this string value, (string token, string replaceWith)[] tokens)
        {
            foreach (var token in tokens)
            {
                var normalizedToken = NormalizeToken(token.token);
                if (string.IsNullOrWhiteSpace(normalizedToken))
                    continue;

                var placeholder = $"{{{{{normalizedToken}}}}}";
                if (value.Contains(placeholder))
                    value = value.Replace(placeholder, token.replaceWith ?? string.Empty);
            }

            return value;
        }

        private static string NormalizeToken(string token)
        {
            if (string.IsNullOrWhiteSpace(token))
                return string.Empty;

            var trimmedToken = token.Trim();
            if (trimmedToken.StartsWith("{{") && trimmedToken.EndsWith("}}") && trimmedToken.Length > 4)
                return trimmedToken[2..^2];

            return trimmedToken;
        }

        public static string GetHtmlTitle(this string html)
        {
            var doc = new HtmlDocument();
            doc.LoadHtml(html);
            var title = doc.DocumentNode.SelectSingleNode("//title");
            return title?.InnerText?.Trim() ?? string.Empty;
        }
    }
}
