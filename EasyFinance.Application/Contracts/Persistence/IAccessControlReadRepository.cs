using System;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.AccessControl;

#nullable enable
namespace EasyFinance.Application.Contracts.Persistence
{
    public interface IAccessControlReadRepository
    {
        Task<RefreshTokenContextDTO?> GetRefreshTokenContextAsync(Guid userId, string tokenProvider, string tokenPurpose);
    }
}
