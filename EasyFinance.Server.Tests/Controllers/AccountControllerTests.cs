using System.Security.Claims;
using System.Security.Principal;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Server.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Moq;
using Shouldly;

#pragma warning disable CS8602 // Dereference of a possibly null reference.
namespace EasyFinance.Server.Tests.Controllers
{
    public class AccountControllerTests
    {
        private readonly Mock<IUserStore<User>> _userStoreMock;
        private readonly Mock<UserManager<User>> _userManagerMock;
        private readonly Mock<IAccessControlService> accessControlService;
        private readonly AccountController _controller;

        public AccountControllerTests()
        {
            _userStoreMock = new Mock<IUserStore<User>>();
            var emailSenderMock = new Mock<IEmailSender<User>>();

#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            _userManagerMock = new Mock<UserManager<User>>(
                _userStoreMock.Object,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);

            var signInManagerMock = new Mock<SignInManager<User>>(
                _userManagerMock.Object,
                Mock.Of<IHttpContextAccessor>(),
                Mock.Of<IUserClaimsPrincipalFactory<User>>(),
                null,
                null,
                null,
                null);
#pragma warning restore CS8625 // Cannot convert null literal to non-nullable reference type.

            this.accessControlService = new Mock<IAccessControlService>();

            _controller = new AccountController(
               userManager: _userManagerMock.Object,
               signInManager: signInManagerMock.Object,
               emailSender: emailSenderMock.Object,
               userService: Mock.Of<IUserService>(),
               linkGenerator: Mock.Of<LinkGenerator>(),
               accessControlService: Mock.Of<IAccessControlService>()
               );
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public async Task SearchUsers_SendNullAndEmpty_ShouldReturnEmptyList(string? searchTerm)
        {
            // Arrange
            _controller.ControllerContext.HttpContext = new DefaultHttpContext
            {
                User = new GenericPrincipal(
                    new GenericIdentity("username"),
                    new string[0]
                    )
            };

            // Act
            var result = await _controller.SearchUsers(searchTerm, Guid.Empty, this.accessControlService.Object);

            // Assert
            var okResult = result as OkObjectResult;
            okResult.ShouldNotBeNull();
            var returnedUsers = okResult.Value.ShouldBeOfType<List<UserProjectResponseDTO>>();
            returnedUsers.ShouldBeEmpty();
        }

        [Theory]
        [InlineData("ohn")]
        [InlineData("jOh")]
        [InlineData("johN")]
        [InlineData("john")]
        [InlineData("John")]
        public async Task SearchUsers_ReturnsMatchingResultsForExactAndPartialCaseInsensitiveFirstNameMatches(string searchTerm)
        {
            // Arrange
            _controller.ControllerContext.HttpContext = new DefaultHttpContext
            {
                User = new GenericPrincipal(
                    new GenericIdentity("username"),
                    new string[0]
                    )
            };

            _userManagerMock.Setup(u => u.GetUserAsync(It.IsAny<ClaimsPrincipal>())).ReturnsAsync(new User(Guid.NewGuid()));
            this.accessControlService.Setup(a => a.GetUsers(It.IsAny<User>(), It.IsAny<Guid>())).ReturnsAsync(new AppResponse<IEnumerable<UserProjectResponseDTO>>());

            var userJohn = new UserBuilder().AddFirstName("John").AddLastName("Doe").AddEmail("john@doe.com").Build();
            var userJohny = new UserBuilder().AddFirstName("Johny").AddLastName("Brown").AddEmail("johny@brown.com").Build();
            var userJohnathan = new UserBuilder().AddFirstName("Johnathan").AddLastName("Nelson").AddEmail("johnathan@nelson.com").Build();
            var userAmir = new UserBuilder().AddFirstName("Amir").AddLastName("Abdollahi").AddEmail("amir@abdollahi.dev").Build();
            _userManagerMock.Setup(u => u.Users).Returns(new[] { userJohn, userJohny, userJohnathan, userAmir }.AsQueryable());

            // Act
            var result = await _controller.SearchUsers(searchTerm, Guid.Empty, this.accessControlService.Object);

            // Assert
            var okResult = result as OkObjectResult;
            var returnedUsers = (okResult.Value as List<UserProjectResponseDTO>);
            returnedUsers.Count.ShouldBe(3);
            returnedUsers.TrueForAll(u => u.UserName.Contains(searchTerm));
        }

        [Theory]
        [InlineData("dOe")]
        [InlineData("doE")]
        [InlineData("doe")]
        [InlineData("DOE")]
        public async Task SearchUsers_ReturnsMatchingResultsForExactAndPartialCaseInsensitiveLastNameMatches(string searchTerm)
        {
            // Arrange
            _controller.ControllerContext.HttpContext = new DefaultHttpContext
            {
                User = new GenericPrincipal(
                    new GenericIdentity("username"),
                    new string[0]
                    )
            };

            _userManagerMock.Setup(u => u.GetUserAsync(It.IsAny<ClaimsPrincipal>())).ReturnsAsync(new User(Guid.NewGuid()));
            this.accessControlService.Setup(a => a.GetUsers(It.IsAny<User>(), It.IsAny<Guid>())).ReturnsAsync(new AppResponse<IEnumerable<UserProjectResponseDTO>>());

            var userJohn = new UserBuilder().AddFirstName("John").AddLastName("Doe").AddEmail("john@doe.com").Build();
            var userJohny = new UserBuilder().AddFirstName("Johny").AddLastName("Doerr").AddEmail("johny@doerr.com").Build();
            var userJohnathan = new UserBuilder().AddFirstName("Johnathan").AddLastName("Doern").AddEmail("johnathan@doern.com").Build();
            var userJenifer = new UserBuilder().AddFirstName("Jenifer").AddLastName("Doepner").AddEmail("jenifer@doepner.com").Build();
            var userAmir = new UserBuilder().AddFirstName("Amir").AddLastName("Abdollahi").AddEmail("amir@abdollahi.dev").Build();
            _userManagerMock.Setup(u => u.Users).Returns(new[] { userJohn, userJohny, userJohnathan, userJenifer, userAmir }.AsQueryable());

            // Act
            var result = await _controller.SearchUsers(searchTerm, Guid.Empty, this.accessControlService.Object);

            // Assert
            var okResult = result as OkObjectResult;
            var returnedUsers = (okResult.Value as List<UserProjectResponseDTO>);
            returnedUsers.Count.ShouldBe(4);
            returnedUsers.TrueForAll(u => u.UserName.Contains(searchTerm));
        }

        [Theory]
        [InlineData("dOe")]
        [InlineData("doE")]
        [InlineData("doe")]
        [InlineData("DOE")]
        public async Task SearchUsers_ReturnsMatchingResultsForExactAndPartialCaseInsensitiveEmailMatches(string searchTerm)
        {
            // Arrange
            _controller.ControllerContext.HttpContext = new DefaultHttpContext
            {
                User = new GenericPrincipal(
                    new GenericIdentity("username"),
                    new string[0]
                    )
            };

            _userManagerMock.Setup(u => u.GetUserAsync(It.IsAny<ClaimsPrincipal>())).ReturnsAsync(new User(Guid.NewGuid()));
            this.accessControlService.Setup(a => a.GetUsers(It.IsAny<User>(), It.IsAny<Guid>())).ReturnsAsync(new AppResponse<IEnumerable<UserProjectResponseDTO>>());

            var userJohn = new UserBuilder().AddFirstName("John").AddLastName("Doe").AddEmail("john@doe.com").Build();
            var userJohny = new UserBuilder().AddFirstName("Johny").AddLastName("Doerr").AddEmail("johny@doerr.com").Build();
            var userJohnathan = new UserBuilder().AddFirstName("Johnathan").AddLastName("Doern").AddEmail("johnathan@doern.com").Build();
            var userJenifer = new UserBuilder().AddFirstName("Jenifer").AddLastName("Doepner").AddEmail("jenifer@doepner.com").Build();
            var cathyJenifer = new UserBuilder().AddFirstName("Cathy").AddLastName("Doering").AddEmail("cathy@doering.com").Build();
            var userAmir = new UserBuilder().AddFirstName("Amir").AddLastName("Abdollahi").AddEmail("amir@abdollahi.dev").Build();
            _userManagerMock.Setup(u => u.Users).Returns(new[] { userJohn, userJohny, userJohnathan, userJenifer, cathyJenifer, userAmir }.AsQueryable());

            // Act
            var result = await _controller.SearchUsers(searchTerm, Guid.Empty, this.accessControlService.Object);

            // Assert
            var okResult = result as OkObjectResult;
            var returnedUsers = (okResult.Value as List<UserProjectResponseDTO>);
            returnedUsers.Count.ShouldBe(5);
            returnedUsers.TrueForAll(u => u.UserEmail.Contains(searchTerm));
        }



        [Theory]
        [InlineData("John")]
        [InlineData("Jenifer")]
        [InlineData("cathy@doering.com")]
        [InlineData("Abdollahi")]
        [InlineData("Alex")]
        public async Task SearchUsers_ReturnsMatchingResultsOfTypeUserSearchResponseDTO(string searchTerm)
        {
            // Arrange
            _controller.ControllerContext.HttpContext = new DefaultHttpContext
            {
                User = new GenericPrincipal(
                    new GenericIdentity("username"),
                    new string[0]
                    )
            };

            _userManagerMock.Setup(u => u.GetUserAsync(It.IsAny<ClaimsPrincipal>())).ReturnsAsync(new User(Guid.NewGuid()));
            this.accessControlService.Setup(a => a.GetUsers(It.IsAny<User>(), It.IsAny<Guid>())).ReturnsAsync(new AppResponse<IEnumerable<UserProjectResponseDTO>>());

            var userJohn = new UserBuilder().AddFirstName("John").AddLastName("Doe").AddEmail("john@doe.com").Build();
            var userJohny = new UserBuilder().AddFirstName("Johny").AddLastName("Doerr").AddEmail("johny@doerr.com").Build();
            var userJohnathan = new UserBuilder().AddFirstName("Johnathan").AddLastName("Doern").AddEmail("johnathan@doern.com").Build();
            var userJenifer = new UserBuilder().AddFirstName("Jenifer").AddLastName("Doepner").AddEmail("jenifer@doepner.com").Build();
            var cathyJenifer = new UserBuilder().AddFirstName("Cathy").AddLastName("Doering").AddEmail("cathy@doering.com").Build();
            var userAmir = new UserBuilder().AddFirstName("Amir").AddLastName("Abdollahi").AddEmail("amir@abdollahi.dev").Build();
            _userManagerMock.Setup(u => u.Users).Returns(new[] { userJohn, userJohny, userJohnathan, userJenifer, cathyJenifer, userAmir }.AsQueryable());

            // Act
            var result = await _controller.SearchUsers(searchTerm, Guid.Empty, this.accessControlService.Object);

            // Assert
            result.ShouldBeOfType<OkObjectResult>();
            var okResult = result as OkObjectResult;
            okResult.ShouldNotBeNull();
            okResult.Value.ShouldBeOfType<List<UserProjectResponseDTO>>();
        }
    }
}
#pragma warning restore CS8602 // Dereference of a possibly null reference.