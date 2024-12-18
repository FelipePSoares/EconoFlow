using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.RegularExpressions;


namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Tags("AccessControl")]
    [Route("api/[controller]")]
    public class AccountController : Controller
    {
        private readonly UserManager<User> userManager;
        private readonly SignInManager<User> signInManager;
        private readonly IEmailSender emailSender;
        private readonly IUserService userService;

        public AccountController(
            UserManager<User> userManager,
            SignInManager<User> signInManager,
            IEmailSender emailSender,
            IUserService userService
            )
        {
            this.userManager = userManager;
            this.signInManager = signInManager;
            this.emailSender = emailSender;
            this.userService = userService;
        }

        [HttpGet]
        public async Task<IActionResult> GetUserAsync()
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            if (user == null)
                BadRequest("User not found!");

            return Ok(new UserResponseDTO(user));
        }

        [HttpPut]
        public async Task<IActionResult> UpdateUserAsync([FromBody] UserRequestDTO userDTO)
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            if (user == null)
                BadRequest("User not found!");

            user.SetFirstName(userDTO.FirstName);
            user.SetLastName(userDTO.LastName);

            if (!string.IsNullOrEmpty(userDTO.PreferredCurrency))
                user.SetPreferredCurrency(userDTO.PreferredCurrency);

            if (!string.IsNullOrEmpty(userDTO.TimeZoneId))
                user.SetTimezone(userDTO.TimeZoneId);

            await this.userManager.UpdateAsync(user);
            await this.signInManager.RefreshSignInAsync(user);

            return Ok(new UserResponseDTO(user));
        }

        [HttpDelete]
        public async Task<IActionResult> DeleteUserAsync([FromBody] UserDeleteRequestDTO request = null)
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            if (user == null)
                BadRequest("User not found!");

#if DEBUG
                var secretKey = "DevSecret_SCXbtFO7XfcVWdBg4FsCwDz8u&D$Hp%$7Eo";
#else
                var secretKey = Environment.GetEnvironmentVariable("EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN") ?? throw new Exception("Secret key for delete token can't be loaded.");
#endif

            if (string.IsNullOrEmpty(request?.ConfirmationToken))
            {
                var token = this.userService.GenerateDeleteToken(user, secretKey);
                var message = await this.userService.GenerateConfirmationMessageAsync(user);

                return Accepted(new
                {
                    confirmationMessage = message,
                    confirmationToken = token
                });
            }
            else if (this.userService.ValidateDeleteToken(user, request.ConfirmationToken, secretKey))
            {
                await this.userService.DeleteUserAsync(user);

                return Ok();
            }

            throw new ValidationException(ValidationMessages.InvalidDeleteToken);
        }

        [HttpPost("logout")]
        public async Task<IActionResult> SignOutAsync()
        {
            await this.signInManager.SignOutAsync();

            return Ok();
        }

        [HttpPut("deactivate")]
        public async Task<IActionResult> DeactivateUserAsync()
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            if (user == null)
                BadRequest("User not found!");

            user.Enabled = false;

            await this.userManager.UpdateAsync(user);
            await this.signInManager.SignOutAsync();

            return Ok();
        }

        [HttpPost("activate")]
        public async Task<IActionResult> ActivateUserAsync()
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            if (user == null)
                BadRequest("User not found!");

            user.Enabled = true;

            await this.userManager.UpdateAsync(user);

            return Ok();
        }

        [HttpPost("testEmail")]
        public async Task TestEmail()
        {
            var to = "felipepsoares@outlook.com.br";
            var subject = "Test Email";
            var htmlContent = "<strong>This is my test email</strong>";

            await emailSender.SendEmailAsync(to, subject, htmlContent);
        }

        [HttpGet("search")]
        public IActionResult SearchUsers([FromQuery] string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return Ok(new List<UserSearchResponseDTO>());
            }

            searchTerm = Regex.Escape(searchTerm).ToLower();

            var users = userManager.Users.Where(u =>
                    u.FirstName.ToLower().Contains(searchTerm) ||
                    u.LastName.ToLower().Contains(searchTerm) ||
                    u.Email.ToLower().Contains(searchTerm))
                .Take(50)
                .Select(u => new UserSearchResponseDTO(u))
                .ToList();

            return Ok(users);
        }
    }
}
