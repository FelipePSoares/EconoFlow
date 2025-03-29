using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using Moq;
using MockQueryable;

namespace EasyFinance.Application.Tests
{
    public class UserServiceTests
    {
        private readonly Mock<UserManager<User>> userManagerMock;
        private readonly Mock<IExpenseService> expenseServiceMock;
        private readonly Mock<IExpenseItemService> expenseItemServiceMock;
        private readonly Mock<IIncomeService> incomeServiceMock;
        private readonly Mock<IProjectService> projectServiceMock;
        private readonly Mock<IUnitOfWork> unitOfWorkMock;
        private readonly UserService userService;

        public UserServiceTests()
        {
#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            var userStoreMock = new Mock<IUserStore<User>>();
            this.userManagerMock = new Mock<UserManager<User>>(
                userStoreMock.Object,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
#pragma warning restore CS8625 // Cannot convert null literal to non-nullable reference type.

            this.expenseServiceMock = new Mock<IExpenseService>();
            this.expenseItemServiceMock = new Mock<IExpenseItemService>();
            this.incomeServiceMock = new Mock<IIncomeService>();
            this.projectServiceMock = new Mock<IProjectService>();
            this.unitOfWorkMock = new Mock<IUnitOfWork>();

            this.userService = new UserService(
                this.userManagerMock.Object,
                this.expenseServiceMock.Object,
                this.expenseItemServiceMock.Object,
                this.incomeServiceMock.Object,
                this.projectServiceMock.Object,
                this.unitOfWorkMock.Object
                );
        }
        
        [Fact]
        public async Task SetDefaultProjectAsync_InexistentProjectId_ShouldReturnError()
        {
            // Arrange
            var user = new User(){
                Id = Guid.NewGuid()
            };

            var projectId = Guid.NewGuid();

            var userProjects = new List<UserProject>()
            {
                new UserProject(user, new Project(Guid.NewGuid()))
            }.BuildMock();

            var userProjectRepository = new Mock<IGenericRepository<UserProject>>();

            userProjectRepository.Setup(repository => repository.Trackable())
                .Returns(userProjects);

            this.unitOfWorkMock.Setup(unitOfWork => unitOfWork.UserProjectRepository)
                .Returns(userProjectRepository.Object);

            // Act
            var action = async () => await this.userService.SetDefaultProjectAsync(user, projectId);

            // Assert
            await action.Should().ThrowAsync<KeyNotFoundException>()
                .WithMessage(ValidationMessages.ProjectNotFoundOrInsufficientUserPermissions);
        }
        
        [Fact]
        public async Task SetDefaultProjectAsync_UserDontHavePermission_ShouldReturnError()
        {
            // Arrange
            var user = new User(){
                Id = Guid.NewGuid()
            };

            var projectId = Guid.NewGuid();

            var userProjects = new List<UserProject>()
            {
                new UserProject(new User(), new Project(projectId)),
                new UserProject(user, new Project(Guid.NewGuid()))
            }.BuildMock();

            var userProjectRepository = new Mock<IGenericRepository<UserProject>>();

            userProjectRepository.Setup(repository => repository.Trackable())
                .Returns(userProjects);

            this.unitOfWorkMock.Setup(unitOfWork => unitOfWork.UserProjectRepository)
                .Returns(userProjectRepository.Object);

            // Act
            var action = async () => await this.userService.SetDefaultProjectAsync(user, projectId);

            // Assert
            await action.Should().ThrowAsync<KeyNotFoundException>()
                .WithMessage(ValidationMessages.ProjectNotFoundOrInsufficientUserPermissions);
        }
        
        [Fact]
        public async Task SetDefaultProjectAsync_ProjectExistsAndUserHasPermission_ShouldReturnSuccess()
        {
            // Arrange
            var user = new User(){
                Id = Guid.NewGuid()
            };

            var projectId = Guid.NewGuid();

            var userProjects = new List<UserProject>()
            {
                new UserProject(user, new Project(projectId))
            }.BuildMock();

            var userProjectRepository = new Mock<IGenericRepository<UserProject>>();

            userProjectRepository.Setup(repository => repository.Trackable())
                .Returns(userProjects);

            this.unitOfWorkMock.Setup(unitOfWork => unitOfWork.UserProjectRepository)
                .Returns(userProjectRepository.Object);

            // Act
            var result = await this.userService.SetDefaultProjectAsync(user, projectId);

            // Assert
            result.Succeeded.Should().BeTrue();
        }

        [Fact]
        public void GenerateDeleteToken_ValidUser_ShouldReturnValidToken()
        {
            // Arrange
            var secretKey = "SCXbtFO7XfcVWdBg4FsCwDz8u&D$Hp%$7Eo";
            var user = new User(){
                Id = Guid.NewGuid()
            };

            // Act
            var token = this.userService.GenerateDeleteToken(user, secretKey);

            // Assert
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(secretKey);

            tokenHandler.ValidateToken(token, new TokenValidationParameters
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

            tokenUserId.Should().Be(user.Id.ToString());
            tokenAction.Should().Be("confirm_delete");
        }

        [Fact]
        public void ValidateDeleteToken_ValidData_ShouldReturnTrue()
        {
            // Arrange
            var secretKey = "SCXbtFO7XfcVWdBg4FsCwDz8u&D$Hp%$7Eo";
            var user = new User(){
                Id = Guid.NewGuid()
            };
            
            var token = this.GenerateToken(user, secretKey);

            // Act
            var result = this.userService.ValidateDeleteToken(user, token, secretKey);

            // Assert
            result.Should().BeTrue();
        }

        [Fact]
        public void ValidateDeleteToken_InvalidUser_ShouldReturnFalse()
        {
            // Arrange
            var secretKey = "SCXbtFO7XfcVWdBg4FsCwDz8u&D$Hp%$7Eo";
            var user = new User(){
                Id = Guid.NewGuid()
            };
            var user2 = new User(){
                Id = Guid.NewGuid()
            };
            
            var token = this.GenerateToken(user, secretKey);

            // Act
            var result = this.userService.ValidateDeleteToken(user2, token, secretKey);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public void ValidateDeleteToken_InvalidAction_ShouldReturnFalse()
        {
            // Arrange
            var secretKey = "SCXbtFO7XfcVWdBg4FsCwDz8u&D$Hp%$7Eo";
            var user = new User(){
                Id = Guid.NewGuid()
            };
            
            var token = this.GenerateToken(user, secretKey, "Test");

            // Act
            var result = this.userService.ValidateDeleteToken(user, token, secretKey);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public void ValidateDeleteToken_InvalidSecretKey_ShouldReturnFalse()
        {
            // Arrange
            var secretKey = "SCXbtFO7XfcVWdBg4FsCwDz8u&D$Hp%$7Eo";
            var secretKey2 = "Q3WV0@10epC2^Xa!JMCnNOvNx5yp5j2poKb";
            var user = new User(){
                Id = Guid.NewGuid()
            };
            
            var token = this.GenerateToken(user, secretKey);

            // Act
            var result = this.userService.ValidateDeleteToken(user, token, secretKey2);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task GenerateConfirmationMessageAsync_ViewerUser_ShouldReturnDefaultMessage()
        {
            // Arrange
            var user = new User(){
                Id = Guid.NewGuid()
            };
            
            this.projectServiceMock.Setup(x => x.GetProjectsWhereUserIsSoleAdminAsync(It.IsAny<User>()))
                .ReturnsAsync(AppResponse<IList<string>>.Success([]));

            // Act
            var results = await this.userService.GenerateConfirmationMessageAsync(user);

            // Assert
            results.Should().Be(ValidationMessages.WarningMessageToUserWhoWantsToDeleteAccount);
        }

        [Fact]
        public async Task GenerateConfirmationMessageAsync_SoleAdminUser_ShouldReturnAdminMessageWithProjectsName()
        {
            // Arrange
            var user = new User(){
                Id = Guid.NewGuid()
            };
            
            this.projectServiceMock.Setup(x => x.GetProjectsWhereUserIsSoleAdminAsync(It.IsAny<User>()))
                .ReturnsAsync(AppResponse<IList<string>>.Success(new List<string> { "Test Project" }));
                
            // Act
            var result = await this.userService.GenerateConfirmationMessageAsync(user);

            // Assert
            result.Should().Be("<p>This action is permanent and cannot be undone. Are you sure you want to delete your account?</p><p><span style=\"color: #ff0000;\">You are associated as a sole administrator of the projects below:</span></p><ul><li>Test Project</li></ul><p>Please transfer the administration to another user before deleting your account. Otherwise, the project(s) will be deleted also.</p>");
        }

        private string GenerateToken(User user, string secretKey, string action = "confirm_delete"){
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(secretKey);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(
                [
                    new Claim("userId", user.Id.ToString()),
                    new Claim("action", action)
                ]),
                Expires = DateTime.UtcNow.AddMinutes(5), // Token valid for 5 minutes
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}