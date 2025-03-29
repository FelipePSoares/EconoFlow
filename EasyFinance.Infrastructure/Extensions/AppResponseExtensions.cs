using System.Collections.Generic;
using System.Linq;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Infrastructure.Extensions
{

    public static class AppResponseExtensions
    {
        public static IEnumerable<AppMessage> AddPrefix(this IEnumerable<AppMessage> messages, string prefix)
        {
            return messages.Select(m => new AppMessage($"{prefix}.{m.Code}", m.Description));
        }
    }
}
