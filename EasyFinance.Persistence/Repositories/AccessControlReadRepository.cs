using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Persistence.DatabaseContext;
using Microsoft.EntityFrameworkCore;

#nullable enable
namespace EasyFinance.Persistence.Repositories
{
    public class AccessControlReadRepository(EasyFinanceDatabaseContext context) : IAccessControlReadRepository
    {
        private readonly EasyFinanceDatabaseContext context = context;

        public async Task<RefreshTokenContextDTO?> GetRefreshTokenContextAsync(Guid userId, string tokenProvider, string tokenPurpose)
        {
            var rows = await (
                from User in this.context.Users
                where User.Id == userId
                join token in this.context.UserTokens
                    .Where(t => t.LoginProvider == tokenProvider && t.Name == tokenPurpose)
                    on User.Id equals token.UserId into tokenGroup
                from token in tokenGroup.DefaultIfEmpty()
                join userRole in this.context.UserRoles
                    on User.Id equals userRole.UserId into userRoleGroup
                from userRole in userRoleGroup.DefaultIfEmpty()
                join role in this.context.Roles
                    on userRole != null ? userRole.RoleId : Guid.Empty equals role.Id into roleGroup
                from role in roleGroup.DefaultIfEmpty()
                select new
                {
                    User = User,
                    StoredRefreshToken = token != null ? token.Value : null,
                    Role = role != null ? role.Name : null
                })
                .ToListAsync();

            if (rows.Count == 0)
                return null;

            var user = rows[0].User;
            var storedRefreshToken = rows
                .Select(r => r.StoredRefreshToken)
                .FirstOrDefault(value => !string.IsNullOrEmpty(value)) ?? string.Empty;

            var roles = rows
                .Where(r => !string.IsNullOrEmpty(r.Role))
                .Select(r => r.Role!)
                .Distinct(StringComparer.Ordinal)
                .ToArray();

            return new RefreshTokenContextDTO(user, storedRefreshToken, roles);
        }
    }
}
