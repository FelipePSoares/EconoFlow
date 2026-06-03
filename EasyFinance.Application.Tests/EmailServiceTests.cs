using System;
using System.Globalization;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.Features.EmailService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Moq;

namespace EasyFinance.Application.Tests
{
    public class EmailServiceTests
    {
        private readonly Mock<IEmailSender> emailSenderMock;
        private readonly Mock<IUserService> userServiceMock;
        private readonly Mock<UserManager<User>> userManagerMock;
        private readonly EmailService emailService;

        public EmailServiceTests()
        {
#pragma warning disable CS8625
            var userStoreMock = new Mock<IUserStore<User>>();
            this.userManagerMock = new Mock<UserManager<User>>(
                userStoreMock.Object, null, null, null, null, null, null, null, null);
#pragma warning restore CS8625

            this.emailSenderMock = new Mock<IEmailSender>();
            this.userServiceMock = new Mock<IUserService>();

            this.emailService = new EmailService(
                this.emailSenderMock.Object,
                this.userServiceMock.Object,
                this.userManagerMock.Object);
        }

        [Fact]
        public async Task SendEmailAsync_WithConfirmEmailTemplate_ShouldNotThrowNotImplementedException()
        {
            var user = new UserBuilder().AddLanguage("pt-BR").Build();
            this.userManagerMock
                .Setup(m => m.FindByIdAsync(user.Id.ToString()))
                .ReturnsAsync(user);
            this.userServiceMock
                .Setup(s => s.GenerateUnsubscribeSignature(It.IsAny<Guid>()))
                .Returns("sig");

            var act = async () => await this.emailService.SendEmailAsync(
                user.Id,
                user.Email!,
                EmailTemplates.ConfirmEmail,
                CultureInfo.InvariantCulture,
                ("confirmLink", "https://example.com/confirm"));

            // Reaches template loading (FileNotFoundException), NOT NotImplementedException
            await act.Should().NotThrowAsync<NotImplementedException>();
        }

        [Fact]
        public async Task SendEmailAsync_WithResetPasswordTemplate_ShouldNotThrowNotImplementedException()
        {
            var user = new UserBuilder().AddLanguage("en-US").Build();
            this.userManagerMock
                .Setup(m => m.FindByIdAsync(user.Id.ToString()))
                .ReturnsAsync(user);
            this.userServiceMock
                .Setup(s => s.GenerateUnsubscribeSignature(It.IsAny<Guid>()))
                .Returns("sig");

            var act = async () => await this.emailService.SendEmailAsync(
                user.Id,
                user.Email!,
                EmailTemplates.ResetPassword,
                CultureInfo.InvariantCulture,
                ("resetLink", "https://example.com/reset"));

            // Reaches template loading (FileNotFoundException), NOT NotImplementedException
            await act.Should().NotThrowAsync<NotImplementedException>();
        }

        [Fact]
        public async Task SendEmailAsync_WithConfirmEmailTemplate_ShouldLookUpUserById()
        {
            var user = new UserBuilder().AddLanguage("en-US").Build();
            this.userManagerMock
                .Setup(m => m.FindByIdAsync(user.Id.ToString()))
                .ReturnsAsync(user);
            this.userServiceMock
                .Setup(s => s.GenerateUnsubscribeSignature(It.IsAny<Guid>()))
                .Returns("sig");

            try
            {
                await this.emailService.SendEmailAsync(
                    user.Id,
                    user.Email!,
                    EmailTemplates.ConfirmEmail,
                    CultureInfo.InvariantCulture);
            }
            catch (Exception ex) when (ex is not NotImplementedException)
            {
                // Expected — template file is not present in test output directory
            }

            this.userManagerMock.Verify(m => m.FindByIdAsync(user.Id.ToString()), Times.Once);
        }

        [Fact]
        public async Task SendEmailAsync_WithResetPasswordTemplate_AndNoUserId_ShouldLookUpUserByEmail()
        {
            var user = new UserBuilder().AddLanguage("en-US").Build();
            this.userManagerMock
                .Setup(m => m.FindByEmailAsync(user.Email!))
                .ReturnsAsync(user);
            this.userServiceMock
                .Setup(s => s.GenerateUnsubscribeSignature(It.IsAny<Guid>()))
                .Returns("sig");

            try
            {
                await this.emailService.SendEmailAsync(
                    user.Email!,
                    EmailTemplates.ResetPassword,
                    CultureInfo.InvariantCulture);
            }
            catch (Exception ex) when (ex is not NotImplementedException)
            {
                // Expected — template file is not present in test output directory
            }

            this.userManagerMock.Verify(m => m.FindByEmailAsync(user.Email!), Times.AtLeastOnce);
        }
    }
}
