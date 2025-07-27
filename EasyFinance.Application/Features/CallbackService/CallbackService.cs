using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Http;

namespace EasyFinance.Application.Features.CallbackService
{
    public class CallbackService(IHttpContextAccessor httpContextAccessor) : ICallbackService
    {
        private readonly IHttpContextAccessor httpContextAccessor = httpContextAccessor;

        public string GenerateCallbackUrl(string relativePath, IDictionary<string, string> queryParams = null)
        {
            var uriBuilder = new UriBuilder($"{this.BaseUrl.TrimEnd('/')}/{relativePath.TrimStart('/')}");

            if (queryParams is not null)
            {
                var query = string.Join("&", queryParams
                    .Select(kvp => $"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value)}"));
                uriBuilder.Query = query;
            }

            return uriBuilder.ToString();
        }

        private string BaseUrl
        {
            get
            {
                var httpContext = httpContextAccessor.HttpContext ?? throw new InvalidOperationException("HttpContext is not available.");

                return $"{httpContext.Request.Scheme}://{httpContext.Request.Host}";
            }
        }
    }
}
