using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.Features.AccessControlService
{
    public class AccessControlService : IAccessControlService
    {
        private readonly IUnitOfWork unitOfWork;
        private readonly UserManager<User> userManager;
        private readonly IEmailSender emailSender;
        private readonly ILogger<AccessControlService> logger;

        public AccessControlService(
            IUnitOfWork unitOfWork,
            UserManager<User> userManager,
            IEmailSender emailSender,
            ILogger<AccessControlService> logger)
        {
            this.unitOfWork = unitOfWork;
            this.userManager = userManager;
            this.emailSender = emailSender;
            this.logger = logger;
        }

        public bool HasAuthorization(Guid userId, Guid projectId, Role accessNeeded)
        {
            var access = this.unitOfWork.UserProjectRepository.NoTrackable().FirstOrDefault(up => up.User.Id == userId && up.Project.Id == projectId);

            return access != null && access.Role >= accessNeeded;
        }

        public async Task<AppResponse<IEnumerable<UserProjectResponseDTO>>> UpdateAccessAsync(User inviterUser, Guid projectId, JsonPatchDocument<IList<UserProjectRequestDTO>> userProjectsDto)
        {
            if (!this.HasAuthorization(inviterUser.Id, projectId, Role.Admin))
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(code: ValidationMessages.Forbidden, description: ValidationMessages.Forbidden);

            var project = unitOfWork.ProjectRepository.NoTrackable().FirstOrDefault(up => up.Id == projectId);
            var existingUserProject = unitOfWork.UserProjectRepository.Trackable().Include(up => up.User).Include(up => up.Project).Where(up => up.Project.Id == projectId).ToList();

            if (userProjectsDto.Operations.Count == 0)
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Success(existingUserProject.ToDTO());

            var dto = existingUserProject.ToRequestDTO().ToList();

            userProjectsDto.ApplyTo(dto);

            var entities = dto.FromDTO(project, existingUserProject);

            if (!entities.Any(r => r.Role == Role.Admin))
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(description: ValidationMessages.AdminRequired);

            await InsertOrUpdateUserProjects(entities);

            var affectedUsers = unitOfWork.GetAffectedUsers();

            await unitOfWork.CommitAsync();

            await this.SendEmailsToAffectedUsersAsync(inviterUser, entities, affectedUsers);

            return AppResponse<IEnumerable<UserProjectResponseDTO>>.Success(entities.ToDTO());
        }

        private async Task InsertOrUpdateUserProjects(IEnumerable<UserProject> entities)
        {
            foreach (var userProject in entities)
            {
                if (userProject.User.Id == default)
                {
                    var user = await userManager.FindByEmailAsync(userProject.Email);
                    if (user != default)
                        userProject.SetUser(user);
                }
                else
                {
                    var user = await userManager.FindByIdAsync(userProject.User.Id.ToString());
                    if (user != default)
                        userProject.SetUser(user);
                }
                unitOfWork.UserProjectRepository.InsertOrUpdate(userProject);
            }
        }

        private async Task SendEmailsToAffectedUsersAsync(User inviterUser, IEnumerable<UserProject> userProjects, ICollection<Guid> affectedUsers)
        {
            try
            {
                var sendingEmails = new List<Task>();

                foreach (var userProject in userProjects.Where(up => !up.Accepted))
                {
                    var email = userProject.User.Email ?? userProject.Email;

                    if (userProject.User.Id == default)
                        sendingEmails.Add(emailSender.SendEmailAsync(email, "You have received an invitation", $"You have received an invitation from {inviterUser.FullName} to join Econoflow in the {userProject.Project.Name} project. Click the button below to accept it. {{{userProject.Token}}}"));
                    else if (affectedUsers.Contains(userProject.User.Id))
                        sendingEmails.Add(emailSender.SendEmailAsync(email, "You have been granted access to a project", $"You have received an invitation from {inviterUser.FullName} to join in the {userProject.Project.Name} project. Click the button below to accept it. {{{userProject.Token}}}"));
                }

                foreach (var userProject in userProjects.Where(up => up.Accepted && affectedUsers.Contains(up.User.Id)))
                {
                    sendingEmails.Add(emailSender.SendEmailAsync(userProject.User.Email, "Your grant access level has been changed.", $"Your grant access level in the {userProject.Project.Name} project has been changed by {inviterUser.FullName}. Your access level now is {userProject.Role}"));
                }

                await Task.WhenAll(sendingEmails.ToArray());
            }
            catch (Exception ex)
            {
                logger.LogError(ex, ex.Message);
            }
        }
    }
}
