using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.AccessControl;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class ProjectServiceTests : BaseTests
    {
        public ProjectServiceTests()
        {
            PrepareInMemoryDatabase();
        }

        [Fact]
        public async Task DeleteOrRemoveLinkAsync_RemoveUserSoleAdmin_ShouldDeleteProjects()
        {
            // Arrange
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var projectService = scopedServices.GetRequiredService<IProjectService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();
            var userManager = scopedServices.GetRequiredService<UserManager<User>>();

            // Act
            await projectService.DeleteOrRemoveLinkAsync(this.user1);

            // Assert
            var projects = unitOfWork.ProjectRepository.NoTrackable().ToList();
            projects.Should().HaveCount(1);
            projects.Last().Should().NotBeNull();
            projects.Last().Id.Should().Be(project3.Id);
        }

        [Fact]
        public async Task DeleteOrRemoveLinkAsync_RemoveOnlyViewerUser_ShouldKeepAllProjects()
        {
            // Arrange
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var projectService = scopedServices.GetRequiredService<IProjectService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Act
            await projectService.DeleteOrRemoveLinkAsync(this.user3);

            // Assert
            var projects = unitOfWork.ProjectRepository.NoTrackable().ToList();
            projects.Should().HaveCount(3);
        }

        [Fact]
        public async Task DeleteOrRemoveLinkAsync_RemoveNotSoleAdminUser_ShouldKeepAllProjects()
        {
            // Arrange
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var projectService = scopedServices.GetRequiredService<IProjectService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Act
            await projectService.DeleteOrRemoveLinkAsync(this.user2);

            // Assert
            var projects = unitOfWork.ProjectRepository.NoTrackable().ToList();
            projects.Should().HaveCount(3);
        }
    }
}
