﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.DTOs.Email;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.CallbackService;
using EasyFinance.Application.Features.EmailService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace EasyFinance.Application.Features.AccessControlService
{
    public class AccessControlService(
        IUnitOfWork unitOfWork,
        UserManager<User> userManager,
        IEmailService emailService,
        ICallbackService callbackService,
        ILogger<AccessControlService> logger) : IAccessControlService
    {
        private readonly IUnitOfWork unitOfWork = unitOfWork;
        private readonly UserManager<User> userManager = userManager;
        private readonly IEmailService emailService = emailService;
        private readonly ICallbackService callbackService = callbackService;
        private readonly ILogger<AccessControlService> logger = logger;

        public bool HasAuthorization(Guid userId, Guid projectId, Role accessNeeded)
        {
            var access = this.unitOfWork.UserProjectRepository.NoTrackable().FirstOrDefault(up => up.User.Id == userId && up.Project.Id == projectId);

            return access != null && access.Role >= accessNeeded;
        }

        public async Task<AppResponse> AcceptInvitationAsync(User user, Guid token)
        {
            var userProject = unitOfWork.UserProjectRepository.Trackable().IgnoreQueryFilters().Include(up => up.Project).Include(up => up.User).FirstOrDefault(up => up.Token == token && !up.Accepted);
            if (userProject == default)
                throw new KeyNotFoundException(ValidationMessages.InviteNotFound);

            if (userProject.User?.Id != user.Id && userProject.Email != user.Email)
                throw new UnauthorizedAccessException();

            userProject.SetUser(user);

            var resultSetAccepted = userProject.SetAccepted();
            if (!resultSetAccepted.Succeeded)
                return resultSetAccepted;

            var result = unitOfWork.UserProjectRepository.InsertOrUpdate(userProject);

            if (result.Failed)
                return result;

            await this.unitOfWork.CommitAsync();
            return AppResponse.Success();
        }

        public async Task<AppResponse<IEnumerable<UserProjectResponseDTO>>> UpdateAccessAsync(User inviterUser, Guid projectId, JsonPatchDocument<IList<UserProjectRequestDTO>> userProjectsDto)
        {
            if (!this.HasAuthorization(inviterUser.Id, projectId, Role.Admin))
                throw new UnauthorizedAccessException();

            var project = unitOfWork.ProjectRepository.Trackable().FirstOrDefault(up => up.Id == projectId);
            var existingUserProject = unitOfWork.UserProjectRepository.Trackable().IgnoreQueryFilters().Include(up => up.User).Where(up => up.Project.Id == projectId && (up.User == null || up.User.Id != inviterUser.Id)).ToList();

            if (userProjectsDto.Operations.Count == 0)
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Success(existingUserProject.ToDTO());

            var dto = existingUserProject.ToRequestDTO().ToList();

            userProjectsDto.ApplyTo(dto);

            var entities = dto.FromDTO(project, existingUserProject);

            // Get modified users to send them an email
            var affectedUsers = unitOfWork.GetAffectedUsers(EntityState.Modified);

            var savedUserProjects = await InsertOrUpdateUserProjects(entities);
            if (savedUserProjects.Failed)
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(savedUserProjects.Messages);

            // Get added users to send them an email
            affectedUsers = [.. affectedUsers, .. unitOfWork.GetAffectedUsers(EntityState.Added)];

            if (entities.Where(e => e.User != null).GroupBy(e => e.User.Id).Any(e => e.Count() > 1) || entities.Where(e => !string.IsNullOrEmpty(e.Email)).GroupBy(e => e.Email).Any(e => e.Count() > 1))
                return AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(code: "User", description: ValidationMessages.DuplicateUser);

            await unitOfWork.CommitAsync();

            await this.SendEmailsToAffectedUsersAsync(inviterUser, entities, affectedUsers);

            return AppResponse<IEnumerable<UserProjectResponseDTO>>.Success(entities.ToDTO());
        }

        private async Task<AppResponse> InsertOrUpdateUserProjects(IEnumerable<UserProject> entities)
        {
            AppResponse appResponse = AppResponse.Success();

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
                var savedUserProject = unitOfWork.UserProjectRepository.InsertOrUpdate(userProject);

                if (savedUserProject.Failed)
                    appResponse.AddErrorMessage(savedUserProject.Messages);
            }

            return appResponse;
        }

        private async Task SendEmailsToAffectedUsersAsync(User inviterUser, IEnumerable<UserProject> userProjects, ICollection<Guid> affectedUsers)
        {
            try
            {
                var sendingEmails = new List<Task>();

                foreach (var userProject in userProjects.Where(up => !up.Accepted))
                {
                    var toEmail = userProject.User?.Email ?? userProject.Email;

                    if (userProject.User == null || userProject.User.Id == default)
                    {
                        if (!userProject.InvitationEmailSent)
                        {
                            var callbackUrl = this.callbackService.GenerateCallbackUrl("register", new Dictionary<string, string>
                            {
                                { "token", userProject.Token.ToString() }
                            });

                            sendingEmails.Add(emailService.SendEmailAsync(
                                toEmail,
                                EmailTemplates.ReceivedInvitation,
                                ("FullName", inviterUser.FullName),
                                ("ProjectName", userProject.Project.Name),
                                ("CallbackUrl", callbackUrl)
                            ));
                            userProject.SetInvitationEmailSent();
                        }
                    }
                    else if (affectedUsers.Contains(userProject.User.Id))
                    {
                        var callbackUrl = this.callbackService.GenerateCallbackUrl($"projects/{userProject.Token}/accept");

                        sendingEmails.Add(emailService.SendEmailAsync(
                            toEmail,
                            EmailTemplates.GrantedAccess,
                            ("FirstName", userProject.User.FirstName),
                            ("FullName", inviterUser.FullName),
                            ("ProjectName", userProject.Project.Name),
                            ("CallbackUrl", callbackUrl)
                        ));
                    }
                }

                foreach (var userProject in userProjects.Where(up => up.Accepted && affectedUsers.Contains(up.User.Id)))
                {
                    sendingEmails.Add(emailService.SendEmailAsync(
                        userProject.User.Email,
                        EmailTemplates.AccessLevelChanged,
                        ("FirstName", userProject.User.FirstName),
                        ("ProjectName", userProject.Project.Name),
                        ("FullName", inviterUser.FullName),
                        ("Role", userProject.Role.ToString())));
                }

                await Task.WhenAll([.. sendingEmails]);
                await unitOfWork.CommitAsync();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, message: ex.Message);
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

            var userProject = unitOfWork.UserProjectRepository
                .Trackable()
                .IgnoreQueryFilters()
                .Include(up => up.User)
                .Include(up => up.Project)
                .FirstOrDefault(e => e.Id == userProjectId);

            if (userProject == null)
                return AppResponse.Success();

            if (userProject.User.DefaultProjectId == userProject.Project.Id)
            {
                userProject.User.SetDefaultProject(null);
                await userManager.UpdateAsync(userProject.User);
            }

            unitOfWork.UserProjectRepository.Delete(userProject);
            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }
    }
}
