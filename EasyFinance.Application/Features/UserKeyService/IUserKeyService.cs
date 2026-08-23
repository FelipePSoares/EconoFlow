using EasyFinance.Application.DTOs.Encryption;
using FpsSoftware.Chassis;

namespace EasyFinance.Application.Features.UserKeyService
{
    public interface IUserKeyService
    {
        AppResponse<UserKeyResponseDTO> GenerateUserKey(string userId);
    }
}
