using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace EasyFinance.Application.Features.UserService
{
    public class UserService(
        UserManager<User> userManager,
        IExpenseService expenseService,
        IExpenseItemService expenseItemService,
        IIncomeService incomeService,
        IProjectService projectService,
        IUnitOfWork unitOfWork
        ) : IUserService
    {
        private const string UnsubscribeSecretEnvironmentVariable = "EconoFlow_UNSUBSCRIBE_HMAC_SECRET";
        private readonly UserManager<User> userManager = userManager;
        private readonly IExpenseService expenseService = expenseService;
        private readonly IExpenseItemService expenseItemService = expenseItemService;
        private readonly IIncomeService incomeService = incomeService;
        private readonly IProjectService projectService = projectService;
        private readonly IUnitOfWork unitOfWork = unitOfWork;

        public async Task<string> GenerateConfirmationMessageAsync(User user)
        {
            var projectsWhereUserIsSoleAdmin = await this.projectService.GetProjectsWhereUserIsSoleAdminAsync(user);

            if (projectsWhereUserIsSoleAdmin.Data.Any()){
                var projects = string.Concat(projectsWhereUserIsSoleAdmin.Data.Select((value) => $"<li>{value}</li>"));
                return string.Format(ValidationMessages.WarningMessageToAdminUserWhoWantsToDeleteAccount, projects);
            }

            return ValidationMessages.WarningMessageToUserWhoWantsToDeleteAccount;
        }

        public string GenerateDeleteToken(User user, string secretKey)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(secretKey);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(
                [
                    new Claim("userId", user.Id.ToString()),
                    new Claim("action", "confirm_delete")
                ]),
                Expires = DateTime.UtcNow.AddMinutes(2), // Token valid for 2 minutes
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        public bool ValidateDeleteToken(User user, string confirmationToken, string secretKey)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(secretKey);

            try
            {
                tokenHandler.ValidateToken(confirmationToken, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero
                }, out SecurityToken validatedToken);

                var jwtToken = (JwtSecurityToken)validatedToken;
                var tokenUserId = jwtToken.Claims.First(x => x.Type == "userId").Value;
                var tokenAction = jwtToken.Claims.First(x => x.Type == "action").Value;

                return tokenUserId == user.Id.ToString() && tokenAction == "confirm_delete";
            }
            catch
            {
                return false;
            }
        }

        public async Task DeleteUserAsync(User user)
        {
            user.SetDefaultProject(null);
            await this.userManager.UpdateAsync(user);

            await this.projectService.DeleteOrRemoveLinkAsync(user);

            var tasks = new List<Task>
            {
                this.expenseService.RemoveLinkAsync(user),
                this.expenseItemService.RemoveLinkAsync(user),
                this.incomeService.RemoveLinkAsync(user)
            };
            await Task.WhenAll(tasks);

            await this.userManager.DeleteAsync(user);
        }

        public async Task<AppResponse> SetDefaultProjectAsync(User user, Guid? defaultProjectId)
        {
            Project project = null;

            if (defaultProjectId.HasValue)
            {
                project = await unitOfWork.UserProjectRepository.Trackable()
                    .Include(up => up.User)
                    .Include(up => up.Project)
                    .Where(up => up.User.Id == user.Id)
                    .Select(up => up.Project)
                    .FirstOrDefaultAsync(up => up.Id == defaultProjectId) ?? throw new KeyNotFoundException(ValidationMessages.ProjectNotFoundOrInsufficientUserPermissions);
            }

            user.SetDefaultProject(project?.Id);

            await this.userManager.UpdateAsync(user);
            return AppResponse.Success();
        }

        public string GenerateUnsubscribeSignature(Guid userId)
        {
            using var hmac = new HMACSHA256(GetUnsubscribeSecretKey());
            var userIdBytes = Encoding.UTF8.GetBytes(userId.ToString("N"));
            var hash = hmac.ComputeHash(userIdBytes);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        public bool ValidateUnsubscribeSignature(Guid userId, string signature)
        {
            if (string.IsNullOrWhiteSpace(signature))
                return false;

            var expectedSignature = this.GenerateUnsubscribeSignature(userId);
            var expectedBytes = Encoding.UTF8.GetBytes(expectedSignature);
            var providedBytes = Encoding.UTF8.GetBytes(signature.Trim().ToLowerInvariant());

            return CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
        }

        public async Task<AppResponse> UnsubscribeFromEmailNotificationsAsync(Guid userId)
        {
            var user = await this.userManager.FindByIdAsync(userId.ToString());

            if (user == null)
                return AppResponse.Success();

            if (!user.NotificationChannels.HasFlag(NotificationChannels.Email))
                return AppResponse.Success();

            user.SetNotificationChannels(user.NotificationChannels & ~NotificationChannels.Email);

            var result = await this.userManager.UpdateAsync(user);

            if (result.Succeeded)
                return AppResponse.Success();

            return AppResponse.Error(result.Errors.Select(error => new AppMessage(error.Code, error.Description)));
        }

        private static byte[] GetUnsubscribeSecretKey()
        {
            var secret = Environment.GetEnvironmentVariable(UnsubscribeSecretEnvironmentVariable);
#if DEBUG
            secret ??= "Development_Unsubscribe_Hmac_Secret_Replace_In_Production";
#endif

            if (string.IsNullOrWhiteSpace(secret))
                throw new InvalidOperationException($"Environment variable '{UnsubscribeSecretEnvironmentVariable}' must be configured.");

            return Encoding.UTF8.GetBytes(secret);
        }
    }
}
