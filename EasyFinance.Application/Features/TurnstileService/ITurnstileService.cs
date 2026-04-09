using System.Threading;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.TurnstileService
{
    public interface ITurnstileService
    {
        Task<bool> ValidateTokenAsync(string token, CancellationToken cancellationToken = default);
        bool IsEnabled();
    }
}
