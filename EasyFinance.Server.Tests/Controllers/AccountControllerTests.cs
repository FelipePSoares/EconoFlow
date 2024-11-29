using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Server.Controllers;
using EasyFinance.Server.DTOs.AccessControl;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Shouldly;


namespace EasyFinance.Server.Tests.Controllers
{
    public class AccountControllerTests
    {
        private readonly Mock<IUserStore<User>> _userStoreMock;
        private readonly Mock<UserManager<User>> _userManagerMock;
        private readonly AccountController _controller;

        public AccountControllerTests()
        {
            _userStoreMock = new Mock<IUserStore<User>>();
            var emailSenderMock = new Mock<IEmailSender>();

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

            _controller = new AccountController(
               userManager: _userManagerMock.Object,
               signInManager: signInManagerMock.Object,
               emailSender: emailSenderMock.Object);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void SearchUsers_SendNullAndEmpty_ShouldReturnEmptyList(string searchTerm)
        {
            // Act
            var result = _controller.SearchUsers(searchTerm);

            // Assert
            var okResult = result as OkObjectResult;
            okResult.ShouldNotBeNull();
            var returnedUsers = okResult.Value.ShouldBeOfType<List<UserSearchResponseDTO>>();
            returnedUsers.ShouldBeEmpty();
        }

        [Theory]
        [InlineData("ohn")]
        [InlineData("jOh")]
        [InlineData("johN")]
        [InlineData("john")]
        [InlineData("John")]
        public void SearchUsers_ReturnsMatchingResultsForExactAndPartialCaseInsensitiveFirstNameMatches(string searchTerm)
        {
            // Arrange
            var userJohn = new UserBuilder().AddFirstName("John").AddLastName("Doe").AddEmail("john@doe.com").Build();
            var userJohny = new UserBuilder().AddFirstName("Johny").AddLastName("Brown").AddEmail("johny@brown.com").Build();
            var userJohnathan = new UserBuilder().AddFirstName("Johnathan").AddLastName("Nelson").AddEmail("johnathan@nelson.com").Build();
            var userAmir = new UserBuilder().AddFirstName("Amir").AddLastName("Abdollahi").AddEmail("amir@abdollahi.dev").Build();
            _userManagerMock.Setup(u => u.Users).Returns(new[] { userJohn, userJohny, userJohnathan, userAmir }.AsQueryable());

            // Act
            var result = _controller.SearchUsers(searchTerm);

            // Assert
            var okResult = result as OkObjectResult;
            var returnedUsers = (okResult.Value as List<UserSearchResponseDTO>);
            returnedUsers.Count.ShouldBe(3);
            returnedUsers.TrueForAll(u => u.FirstName.Contains(searchTerm));
        }

        [Theory]
        [InlineData("dOe")]
        [InlineData("doE")]
        [InlineData("doe")]
        [InlineData("DOE")]
        public void SearchUsers_ReturnsMatchingResultsForExactAndPartialCaseInsensitiveLastNameMatches(string searchTerm)
        {
            // Arrange
            var userJohn = new UserBuilder().AddFirstName("John").AddLastName("Doe").AddEmail("john@doe.com").Build();
            var userJohny = new UserBuilder().AddFirstName("Johny").AddLastName("Doerr").AddEmail("johny@doerr.com").Build();
            var userJohnathan = new UserBuilder().AddFirstName("Johnathan").AddLastName("Doern").AddEmail("johnathan@doern.com").Build();
            var userJenifer = new UserBuilder().AddFirstName("Jenifer").AddLastName("Doepner").AddEmail("jenifer@doepner.com").Build();
            var userAmir = new UserBuilder().AddFirstName("Amir").AddLastName("Abdollahi").AddEmail("amir@abdollahi.dev").Build();
            _userManagerMock.Setup(u => u.Users).Returns(new[] { userJohn, userJohny, userJohnathan, userJenifer, userAmir }.AsQueryable());

            // Act
            var result = _controller.SearchUsers(searchTerm);

            // Assert
            var okResult = result as OkObjectResult;
            var returnedUsers = (okResult.Value as List<UserSearchResponseDTO>);
            returnedUsers.Count.ShouldBe(4);
            returnedUsers.TrueForAll(u => u.LastName.Contains(searchTerm));
        }

        [Theory]
        [InlineData("dOe")]
        [InlineData("doE")]
        [InlineData("doe")]
        [InlineData("DOE")]
        public void SearchUsers_ReturnsMatchingResultsForExactAndPartialCaseInsensitiveEmailMatches(string searchTerm)
        {
            // Arrange
            var userJohn = new UserBuilder().AddFirstName("John").AddLastName("Doe").AddEmail("john@doe.com").Build();
            var userJohny = new UserBuilder().AddFirstName("Johny").AddLastName("Doerr").AddEmail("johny@doerr.com").Build();
            var userJohnathan = new UserBuilder().AddFirstName("Johnathan").AddLastName("Doern").AddEmail("johnathan@doern.com").Build();
            var userJenifer = new UserBuilder().AddFirstName("Jenifer").AddLastName("Doepner").AddEmail("jenifer@doepner.com").Build();
            var cathyJenifer = new UserBuilder().AddFirstName("Cathy").AddLastName("Doering").AddEmail("cathy@doering.com").Build();
            var userAmir = new UserBuilder().AddFirstName("Amir").AddLastName("Abdollahi").AddEmail("amir@abdollahi.dev").Build();
            _userManagerMock.Setup(u => u.Users).Returns(new[] { userJohn, userJohny, userJohnathan, userJenifer, cathyJenifer, userAmir }.AsQueryable());

            // Act
            var result = _controller.SearchUsers(searchTerm);

            // Assert
            var okResult = result as OkObjectResult;
            var returnedUsers = (okResult.Value as List<UserSearchResponseDTO>);
            returnedUsers.Count.ShouldBe(5);
            returnedUsers.TrueForAll(u => u.Email.Contains(searchTerm));
        }



        [Theory]
        [InlineData("John")]
        [InlineData("Jenifer")]
        [InlineData("cathy@doering.com")]
        [InlineData("Abdollahi")]
        [InlineData("Alex")]
        public void SearchUsers_ReturnsMatchingResultsOfTypeUserSearchResponseDTO(string searchTerm)
        {
            // Arrange
            var userJohn = new UserBuilder().AddFirstName("John").AddLastName("Doe").AddEmail("john@doe.com").Build();
            var userJohny = new UserBuilder().AddFirstName("Johny").AddLastName("Doerr").AddEmail("johny@doerr.com").Build();
            var userJohnathan = new UserBuilder().AddFirstName("Johnathan").AddLastName("Doern").AddEmail("johnathan@doern.com").Build();
            var userJenifer = new UserBuilder().AddFirstName("Jenifer").AddLastName("Doepner").AddEmail("jenifer@doepner.com").Build();
            var cathyJenifer = new UserBuilder().AddFirstName("Cathy").AddLastName("Doering").AddEmail("cathy@doering.com").Build();
            var userAmir = new UserBuilder().AddFirstName("Amir").AddLastName("Abdollahi").AddEmail("amir@abdollahi.dev").Build();
            _userManagerMock.Setup(u => u.Users).Returns(new[] { userJohn, userJohny, userJohnathan, userJenifer, cathyJenifer, userAmir }.AsQueryable());

            // Act
            var result = _controller.SearchUsers(searchTerm);

            // Assert
            result.ShouldBeOfType<OkObjectResult>();
            var okResult = result as OkObjectResult;
            okResult.ShouldNotBeNull();
            okResult.Value.ShouldBeOfType<List<UserSearchResponseDTO>>();
        }
    }
}
