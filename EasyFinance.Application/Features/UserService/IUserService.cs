using System.Threading.Tasks;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.Features.UserService
{
    public interface IUserService
    {
        Task<string> GenerateConfirmationMessageAsync(User user);
        string GenerateDeleteToken(User user, string secretKey);
        bool ValidateDeleteToken(User user, string confirmationToken, string secretKey);
        Task DeleteUserAsync(User user);
    }
}
