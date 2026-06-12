using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.ExpoPushTokenService
{
    public interface IExpoPushTokenService
    {
        Task<AppResponse> UpsertTokenAsync(Guid userId, string token, string? deviceName);
        Task<AppResponse> RevokeTokenAsync(Guid userId, string token);
        Task<IEnumerable<string>> GetActiveTokensForUserAsync(Guid userId);
        Task<IDictionary<Guid, IEnumerable<string>>> GetActiveTokensForUsersAsync(IEnumerable<Guid> userIds);
    }
}
