using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Domain.AccessControl;
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
    }
}