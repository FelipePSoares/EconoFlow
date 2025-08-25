using EasyFinance.Application.DTOs.Encryption;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.UserKeyService
{
    public interface IUserKeyService
    {
        AppResponse<UserKeyResponseDTO> GenerateUserKey(string userId);
    }
}
