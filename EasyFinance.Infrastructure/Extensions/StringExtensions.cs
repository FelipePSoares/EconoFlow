using HtmlAgilityPack;

namespace EasyFinance.Infrastructure.Extensions
{
    public static class StringExtensions
    {
        public static string ReplaceTokens(this string value, (string token, string replaceWith)[] tokens)
        {
            foreach (var token in tokens)
                if (value.Contains($"{{{{{token.token}}}}}"))
                    value = value.Replace($"{{{{{token.token}}}}}", token.replaceWith);

            return value;
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
