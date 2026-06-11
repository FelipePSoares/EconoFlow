using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.ExpoPushTokenService
{
    public interface IExpoPushClient
    {
        Task<AppResponse> SendAsync(IEnumerable<ExpoMessage> messages, CancellationToken cancellationToken);
    }
}
