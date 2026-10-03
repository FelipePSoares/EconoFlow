using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Persistence.DatabaseContext;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EasyFinance.Application.Tests
{
    /// <summary>
    /// Integration tests for <see cref="AccessControlService.RemoveAccessAsync"/>.
    /// They run against a real EF Core context because the cases they guard only reproduce when
    /// EF Core resolves the entity graph itself: a pending invitation has no <c>User</c>, so
    /// <c>Include(up =&gt; up.User)</c> materialises null while the query still bypasses the
    /// <c>UserProject.Accepted</c> filter with <c>IgnoreQueryFilters()</c>.
    /// <para>
    /// The regression guard for the reported HTTP 500 is
    /// <see cref="RemoveAccessAsync_PendingInvitationWithoutUser_ShouldNotThrow"/>; it is the only
    /// test here that fails if the null guard is removed from the service.
    /// </para>
    /// </summary>
    public class AccessControlServiceRemoveAccessTests : BaseTests
    {
        public AccessControlServiceRemoveAccessTests()
        {
            PrepareInMemoryDatabase();
        }

        private static User ReloadUser(IServiceProvider serviceProvider, Guid userId)
        {
            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();

            return context.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .First(u => u.Id == userId);
        }

        private static IAccessControlService GetAccessControlService(IServiceScope scope)
            => scope.ServiceProvider.GetRequiredService<IAccessControlService>();

        private static async Task SetDefaultProjectAsync(IServiceScope scope, Guid userId, Guid projectId)
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var user = await userManager.FindByIdAsync(userId.ToString());
            user.SetDefaultProject(projectId);
            await userManager.UpdateAsync(user);
        }

        [Fact]
        public async Task RemoveAccessAsync_UserWithDefaultProject_ShouldClearDefaultProject()
        {
            // Arrange
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var accessControlService = GetAccessControlService(scope);

            await SetDefaultProjectAsync(scope, user2.Id, project1.Id);

            var userProject = unitOfWork.UserProjectRepository.NoTrackable()
                .First(up => up.User.Id == user2.Id && up.Project.Id == project1.Id);

            // Act
            var result = await accessControlService.RemoveAccessAsync(project1.Id, userProject.Id);

            // Assert
            result.Succeeded.Should().BeTrue();

            using var assertScope = serviceProvider.CreateScope();
            var assertUnitOfWork = assertScope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            assertUnitOfWork.UserProjectRepository.NoTrackable()
                .IgnoreQueryFilters()
                .Any(up => up.Id == userProject.Id)
                .Should().BeFalse("the access record must be deleted");

            ReloadUser(serviceProvider, user2.Id).DefaultProjectId
                .Should().BeNull("the removed project can no longer be the default project");
        }

        [Fact]
        public async Task RemoveAccessAsync_DisabledUser_ShouldNotThrowAndShouldClearDefaultProject()
        {
            // Arrange: a deactivated collaborator still owns a User row and IgnoreQueryFilters()
            // also bypasses the User.Enabled filter on the include, so the default project must
            // still be cleared. (Not the regression guard - see the class remarks.)
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var accessControlService = GetAccessControlService(scope);

            await SetDefaultProjectAsync(scope, user2.Id, project1.Id);

            var userProject = unitOfWork.UserProjectRepository.NoTrackable()
                .First(up => up.User.Id == user2.Id && up.Project.Id == project1.Id);

            var storedUser = await userManager.FindByIdAsync(user2.Id.ToString());
            storedUser.SetEnabled(false);
            await userManager.UpdateAsync(storedUser);

            // Act
            var action = async () => await accessControlService.RemoveAccessAsync(project1.Id, userProject.Id);

            // Assert
            await action.Should().NotThrowAsync();

            using var assertScope = serviceProvider.CreateScope();
            var assertUnitOfWork = assertScope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            assertUnitOfWork.UserProjectRepository.NoTrackable()
                .IgnoreQueryFilters()
                .Any(up => up.Id == userProject.Id)
                .Should().BeFalse("the access record must be deleted even for a disabled user");

            var reloaded = ReloadUser(serviceProvider, user2.Id);
            reloaded.Should().NotBeNull("only the Enabled flag is false, the user row still exists");
            reloaded.Enabled.Should().BeFalse();
            reloaded.DefaultProjectId.Should().BeNull("the removed project can no longer be the default project");
        }

        [Fact]
        public async Task RemoveAccessAsync_PendingInvitationWithoutUser_ShouldNotThrow()
        {
            // Arrange: an invitation that was never accepted has an email but no User,
            // so the Include over the optional User navigation materialises null.
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var accessControlService = GetAccessControlService(scope);

            var project = unitOfWork.ProjectRepository.Trackable().First(p => p.Id == project1.Id);
            var invitation = new UserProject(
                user: default,
                project: project,
                role: Role.Viewer,
                email: "pending@example.com");
            var invitationId = unitOfWork.UserProjectRepository.Insert(invitation).Id;
            await unitOfWork.CommitAsync();

            // Act
            var action = async () => await accessControlService.RemoveAccessAsync(project.Id, invitationId);

            // Assert
            await action.Should().NotThrowAsync();

            using var assertScope = serviceProvider.CreateScope();
            var assertUnitOfWork = assertScope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            assertUnitOfWork.UserProjectRepository.NoTrackable()
                .IgnoreQueryFilters()
                .Any(up => up.Id == invitationId)
                .Should().BeFalse("a pending invitation must be revocable");
        }

        [Fact]
        public async Task RemoveAccessAsync_NonDefaultProject_ShouldKeepDefaultProject()
        {
            // Arrange
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var accessControlService = GetAccessControlService(scope);

            await SetDefaultProjectAsync(scope, user2.Id, project1.Id);

            // user2 also has Viewer access to project2 - removing it must not touch DefaultProjectId.
            var otherAccess = unitOfWork.UserProjectRepository.NoTrackable()
                .First(up => up.User.Id == user2.Id && up.Project.Id == project2.Id);

            // Act
            var result = await accessControlService.RemoveAccessAsync(project2.Id, otherAccess.Id);

            // Assert
            result.Succeeded.Should().BeTrue();

            ReloadUser(serviceProvider, user2.Id).DefaultProjectId
                .Should().Be(project1.Id, "only the removed project should be cleared from the default");
        }

        [Fact]
        public async Task RemoveAccessAsync_UnknownUserProjectId_ShouldReturnSuccessWithoutDeletingAnything()
        {
            // Arrange
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var accessControlService = GetAccessControlService(scope);

            var before = unitOfWork.UserProjectRepository.NoTrackable().IgnoreQueryFilters().Count();

            // Act
            var result = await accessControlService.RemoveAccessAsync(project1.Id, Guid.NewGuid());

            // Assert
            result.Succeeded.Should().BeTrue();

            using var assertScope = serviceProvider.CreateScope();
            var assertUnitOfWork = assertScope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            assertUnitOfWork.UserProjectRepository.NoTrackable().IgnoreQueryFilters()
                .Count()
                .Should().Be(before);
        }

        [Fact]
        public async Task RemoveAccessAsync_EmptyUserProjectId_ShouldReturnFailure()
        {
            // Arrange
            using var scope = serviceProvider.CreateScope();
            var accessControlService = GetAccessControlService(scope);

            // Act
            var result = await accessControlService.RemoveAccessAsync(project1.Id, Guid.Empty);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.Should().ContainSingle(message =>
                message.Code == "userProjectId"
                && message.Description == ValidationMessages.InvalidUserProjectId);
        }

        [Fact]
        public async Task RemoveAccessAsync_ShouldNotAffectOtherProjectsAccess()
        {
            // Arrange
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var accessControlService = GetAccessControlService(scope);

            var target = unitOfWork.UserProjectRepository.NoTrackable()
                .First(up => up.User.Id == user2.Id && up.Project.Id == project1.Id);
            var otherProjectIds = unitOfWork.UserProjectRepository.NoTrackable()
                .Where(up => up.User.Id == user2.Id && up.Project.Id != project1.Id)
                .Select(up => up.Project.Id)
                .ToList();

            // Act
            var result = await accessControlService.RemoveAccessAsync(project1.Id, target.Id);

            // Assert
            result.Succeeded.Should().BeTrue();

            using var assertScope = serviceProvider.CreateScope();
            var assertUnitOfWork = assertScope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            List<Guid> remainingProjectIds = assertUnitOfWork.UserProjectRepository.NoTrackable()
                .Where(up => up.User.Id == user2.Id)
                .Select(up => up.Project.Id)
                .ToList();

            remainingProjectIds.Should().BeEquivalentTo(otherProjectIds);
        }

        [Fact]
        public async Task RemoveAccessAsync_UserProjectFromAnotherProject_ShouldNotDeleteIt()
        {
            // Arrange: an Admin of project1 must not be able to revoke a membership of project2
            // by passing project2's membership id together with project1's project id.
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var accessControlService = GetAccessControlService(scope);

            var foreignAccess = unitOfWork.UserProjectRepository.NoTrackable()
                .First(up => up.User.Id == user2.Id && up.Project.Id == project2.Id);

            // Act
            var result = await accessControlService.RemoveAccessAsync(project1.Id, foreignAccess.Id);

            // Assert
            result.Succeeded.Should().BeTrue();

            using var assertScope = serviceProvider.CreateScope();
            var assertUnitOfWork = assertScope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            assertUnitOfWork.UserProjectRepository.NoTrackable()
                .IgnoreQueryFilters()
                .Any(up => up.Id == foreignAccess.Id)
                .Should().BeTrue("a membership of another project must never be deleted through this project");
        }
    }
}
