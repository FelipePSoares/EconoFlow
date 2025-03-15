﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.JsonPatch;
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

        public async Task<AppResponse> AcceptInvitationAsync(User user, Guid token)
        {
            AppResponse result;

            var userProject = unitOfWork.UserProjectRepository.Trackable().Include(up => up.Project).Include(up => up.User).FirstOrDefault(up => up.Token == token);
            if (userProject == default)
                return AppResponse.Error(ValidationMessages.NotFound);

            if (userProject.User?.Id != user.Id && userProject.Email != user.Email)
                return AppResponse.Error(ValidationMessages.Forbidden, ValidationMessages.Forbidden);

            result = userProject.SetUser(user);
            if (!result.Succeeded)
                return result;

            result = userProject.SetAccepted();
            if (!result.Succeeded)
                return result;

            unitOfWork.UserProjectRepository.InsertOrUpdate(userProject);
            await this.unitOfWork.CommitAsync();
            return AppResponse.Success();
        }

        public async Task<AppResponse<IEnumerable<UserProjectResponseDTO>>> UpdateAccessAsync(User inviterUser, Guid projectId, JsonPatchDocument<IList<UserProjectRequestDTO>> userProjectsDto)
        {
            if (!this.HasAuthorization(inviterUser.Id, projectId, Role.Admin))
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(code: ValidationMessages.Forbidden, description: ValidationMessages.Forbidden);

            var project = unitOfWork.ProjectRepository.Trackable().FirstOrDefault(up => up.Id == projectId);
            var existingUserProject = unitOfWork.UserProjectRepository.Trackable().IgnoreQueryFilters().Include(up => up.User).Where(up => up.Project.Id == projectId && (up.User == null || up.User.Id != inviterUser.Id)).ToList();

            if (userProjectsDto.Operations.Count == 0)
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Success(existingUserProject.ToDTO());

            var dto = existingUserProject.ToRequestDTO().ToList();

            userProjectsDto.ApplyTo(dto);

            var entities = dto.FromDTO(project, existingUserProject);

            // Get modified users to send them an email
            var affectedUsers = unitOfWork.GetAffectedUsers(EntityState.Modified);

            await InsertOrUpdateUserProjects(entities);

            // Get added users to send them an email
            affectedUsers = [.. affectedUsers, .. unitOfWork.GetAffectedUsers(EntityState.Added)];

            if (entities.Where(e => e.User != null).GroupBy(e => e.User.Id).Any(e => e.Count() > 1) || entities.Where(e => !string.IsNullOrEmpty(e.Email)).GroupBy(e => e.Email).Any(e => e.Count() > 1))
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(code: "User", description: ValidationMessages.DuplicateUser);

            await unitOfWork.CommitAsync();

            await this.SendEmailsToAffectedUsersAsync(inviterUser, entities, affectedUsers);

            return AppResponse<IEnumerable<UserProjectResponseDTO>>.Success(entities.ToDTO());
        }

        private async Task InsertOrUpdateUserProjects(IEnumerable<UserProject> entities)
        {
            foreach (var userProject in entities)
            {
                if (userProject.User == null || userProject.User.Id == default)
                {
                    var user = await userManager.FindByEmailAsync(userProject.Email);
                    if (user != default)
                        userProject.SetUser(user);
                }
                else if (userProject.Id == default)
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
                    var email = userProject.User?.Email ?? userProject.Email;

                    if (userProject.User == null || userProject.User.Id == default)
                    {
                        if (!userProject.InvitationEmailSent)
                        {
                            sendingEmails.Add(emailSender.SendEmailAsync(email, Emails.InvitationSubject, string.Format(Emails.InvitationHtmlMessage, inviterUser.FullName, userProject.Project.Name, userProject.Token)));
                            userProject.SetInvitationEmailSent();
                        }
                    }
                    else if (affectedUsers.Contains(userProject.User.Id))
                        sendingEmails.Add(emailSender.SendEmailAsync(email, Emails.GrantedAccessSubject, string.Format(Emails.GrantedAccessHtmlMessage, userProject.User.FirstName, inviterUser.FullName, userProject.Project.Name, userProject.Token)));
                }

                foreach (var userProject in userProjects.Where(up => up.Accepted && affectedUsers.Contains(up.User.Id)))
                {
                    sendingEmails.Add(emailSender.SendEmailAsync(userProject.User.Email, Emails.GrantedAccessChangedSubject, string.Format(Emails.GrantedAccessChangedHtmlMessage, userProject.User.FirstName, userProject.Project.Name, inviterUser.FullName, userProject.Role)));
                }

                await Task.WhenAll([.. sendingEmails]);
                await unitOfWork.CommitAsync();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, ex.Message);
            }
        }

        public async Task<AppResponse<IEnumerable<UserProjectResponseDTO>>> GetUsers(User user, Guid projectId)
        {
            var userProjects = await this.unitOfWork.UserProjectRepository.NoTrackable()
                .IgnoreQueryFilters()
                .Include(up => up.User)
                .Include(up => up.Project)
                .Where(up => up.Project.Id == projectId && up.User.Id != user.Id)
                .ToListAsync();

            return AppResponse<IEnumerable<UserProjectResponseDTO>>.Success(userProjects.ToDTO());
        }

        public async Task<AppResponse<IEnumerable<UserResponseDTO>>> GetAllKnowUsersAsync(User user, Guid? projectId)
        {
            var usersToFilter = new List<Guid>();

            if (projectId != null)
            {
                usersToFilter = await this.unitOfWork.UserProjectRepository.NoTrackable()
                    .Where(up => up.Project.Id == projectId)
                    .Select(up => up.User.Id)
                    .ToListAsync();
            }

            var projectIds = await this.unitOfWork.UserProjectRepository.NoTrackable()
                .Where(up => up.User.Id == user.Id)
                .Select(up => up.Project.Id)
                .ToListAsync();

            var users = await this.unitOfWork.UserProjectRepository.NoTrackable()
                .IgnoreQueryFilters()
                .Include(up => up.User)
                .Where(up => projectIds.Contains(up.Project.Id) && !usersToFilter.Contains(up.User.Id))
                .Select(up => up.User)
                .Distinct()
                .ToListAsync();

            return AppResponse<IEnumerable<UserResponseDTO>>.Success(users.ToDTO());
        }

        public async Task<AppResponse> RemoveAccessAsync(Guid userProjectId)
        {
            if (userProjectId == Guid.Empty)
                AppResponse<ExpenseResponseDTO>.Error(code: nameof(userProjectId), description: ValidationMessages.InvalidUserProjectId);

            var userProject = unitOfWork.UserProjectRepository.Trackable().IgnoreQueryFilters().FirstOrDefault(e => e.Id == userProjectId);

            if (userProject == null)
                return AppResponse.Error(code: ValidationMessages.NotFound, ValidationMessages.NotFound);

            unitOfWork.UserProjectRepository.Delete(userProject);
            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }
    }
}
