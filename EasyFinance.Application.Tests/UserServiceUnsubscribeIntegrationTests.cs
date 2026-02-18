using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Persistence.Repositories;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class UserServiceUnsubscribeIntegrationTests
    {
        private readonly ServiceProvider serviceProvider;

        public UserServiceUnsubscribeIntegrationTests()
        {
            var services = new ServiceCollection();
            services.AddDbContext<EasyFinanceDatabaseContext>(options =>
                options.UseInMemoryDatabase(Guid.NewGuid().ToString()));

            services.AddScoped<IUnitOfWork, UnitOfWork>();
            services.AddScoped<IProjectService, ProjectService>();
            services.AddScoped<IExpenseService, ExpenseService>();
            services.AddScoped<IExpenseItemService, ExpenseItemService>();
            services.AddScoped<IIncomeService, IncomeService>();
            services.AddScoped<IUserService, UserService>();

            services.AddIdentityCore<User>()
                .AddEntityFrameworkStores<EasyFinanceDatabaseContext>();

            this.serviceProvider = services.BuildServiceProvider();
        }

        [Fact]
        public async Task UnsubscribeFromEmailNotificationsAsync_WhenUserExists_ShouldUnsetEmailFlagAndKeepOtherFlags()
        {
            // Arrange
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var userManager = scopedServices.GetRequiredService<UserManager<User>>();
            var userService = scopedServices.GetRequiredService<IUserService>();
            var email = "integration@test.com";

            var user = new User(firstName: "Integration", lastName: "User", notificationChannels: NotificationChannels.Email | NotificationChannels.Push)
            {
                UserName = email,
                Email = email
            };
            await userManager.CreateAsync(user, "Passw0rd!");

            // Act
            var response = await userService.UnsubscribeFromEmailNotificationsAsync(user.Id);
            var updatedUser = await userManager.FindByEmailAsync(email);

            // Assert
            response.Succeeded.Should().BeTrue();
            updatedUser.Should().NotBeNull();
            updatedUser!.NotificationChannels.HasFlag(NotificationChannels.Email).Should().BeFalse();
            updatedUser.NotificationChannels.HasFlag(NotificationChannels.Push).Should().BeTrue();
        }

        [Fact]
        public async Task UnsubscribeFromEmailNotificationsAsync_WhenUserDoesNotExist_ShouldReturnSuccess()
        {
            // Arrange
            using var scope = this.serviceProvider.CreateScope();
            var userService = scope.ServiceProvider.GetRequiredService<IUserService>();

            // Act
            var response = await userService.UnsubscribeFromEmailNotificationsAsync(Guid.NewGuid());

            // Assert
            response.Succeeded.Should().BeTrue();
        }

        [Fact]
        public void ValidateUnsubscribeSignature_WithGeneratedSignature_ShouldReturnTrue()
        {
            // Arrange
            using var scope = this.serviceProvider.CreateScope();
            var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
            var userId = Guid.NewGuid();
            var signature = userService.GenerateUnsubscribeSignature(userId);

            // Act
            var isValid = userService.ValidateUnsubscribeSignature(userId, signature);

            // Assert
            isValid.Should().BeTrue();
        }
    }
}
