using System.Collections.Generic;

namespace EasyFinance.Application.Features.CallbackService
{
    public interface ICallbackService
    {
        string GenerateCallbackUrl(string relativePath, IDictionary<string, string>? queryParams = null);
    }
}
