using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Serilog;


namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Tags("AccessControl")]
    [Route("api/[controller]")]
    public class AccountController : BaseController
    {
        // Validate the email address using DataAnnotations like the UserValidator does when RequireUniqueEmail = true.
        private static readonly EmailAddressAttribute emailAddressAttribute = new();

        private readonly UserManager<User> userManager;
        private readonly SignInManager<User> signInManager;
        private readonly IEmailSender<User> emailSender;
        private readonly IUserService userService;
        private readonly LinkGenerator linkGenerator;
        private readonly IAccessControlService accessControlService;

        public AccountController(
            UserManager<User> userManager,
            SignInManager<User> signInManager,
            IEmailSender<User> emailSender,
            IUserService userService,
            LinkGenerator linkGenerator,
            IAccessControlService accessControlService)
        {
            this.userManager = userManager;
            this.signInManager = signInManager;
            this.emailSender = emailSender;
            this.userService = userService;
            this.linkGenerator = linkGenerator;
            this.accessControlService = accessControlService;
        }

        [HttpGet]
        public async Task<IActionResult> GetUserAsync()
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                BadRequest("User not found!");

            return Ok(new UserResponseDTO(user));
        }

        [HttpPut]
        public async Task<IActionResult> UpdateUserAsync([FromBody] UserRequestDTO userDTO)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                BadRequest("User not found!");

            user.SetFirstName(userDTO.FirstName);
            user.SetLastName(userDTO.LastName);

            if (!string.IsNullOrEmpty(userDTO.PreferredCurrency))
                user.SetPreferredCurrency(userDTO.PreferredCurrency);

            await this.userManager.UpdateAsync(user);
            await this.signInManager.RefreshSignInAsync(user);

            return Ok(new UserResponseDTO(user));
        }

        [HttpPut("default-project/{defaultProjectId?}")]
        public async Task<IActionResult> SetDefaultProject(Guid? defaultProjectId = null)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                BadRequest("User not found!");

            var result = await this.userService.SetDefaultProjectAsync(user, defaultProjectId);

            return ValidateResponse(result, HttpStatusCode.OK);
        }

        [HttpDelete]
        public async Task<IActionResult> DeleteUserAsync([FromBody] UserDeleteRequestDTO request = null)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

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

            return this.ValidateResponse(AppResponse.Error(ValidationMessages.InvalidDeleteToken), HttpStatusCode.OK);
        }

        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<IActionResult> Register([FromServices] IUserStore<User> userStore, [FromBody] RegisterRequest registration, [FromQuery] Guid? token = null)
        {
            if (!userManager.SupportsUserEmail)
            {
                throw new NotSupportedException($"{nameof(AccountController)} requires a user store with email support.");
            }

            var emailStore = (IUserEmailStore<User>)userStore;
            var email = registration.Email;

            if (string.IsNullOrEmpty(email) || !emailAddressAttribute.IsValid(email))
            {
                var error = userManager.ErrorDescriber.InvalidEmail(email);
                return this.ValidateResponse(AppResponse.Error(error.Code, error.Description), HttpStatusCode.OK);
            }

            var user = new User();
            await userStore.SetUserNameAsync(user, email, CancellationToken.None);
            await emailStore.SetEmailAsync(user, email, CancellationToken.None);
            var result = await userManager.CreateAsync(user, registration.Password);

            if (!result.Succeeded)
            {
                return this.ValidateResponse(result);
            }

            if (token.HasValue)
            {
                try
                {
                    await accessControlService.AcceptInvitationAsync(user, token.Value);
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Failed to accept invitation for user {User}", user.Id);
                }
            }

            await SendConfirmationEmailAsync(user, HttpContext, email);
            return Ok();
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> SignInAsync([FromBody] LoginRequest login, [FromQuery] bool? useCookies, [FromQuery] bool? useSessionCookies)
        {
            var useCookieScheme = (useCookies == true) || (useSessionCookies == true);
            var isPersistent = (useCookies == true) && (useSessionCookies != true);
            signInManager.AuthenticationScheme = useCookieScheme ? IdentityConstants.ApplicationScheme : IdentityConstants.BearerScheme;

            var result = await signInManager.PasswordSignInAsync(login.Email, login.Password, isPersistent, lockoutOnFailure: true);

            if (result.RequiresTwoFactor)
            {
                if (!string.IsNullOrEmpty(login.TwoFactorCode))
                {
                    result = await signInManager.TwoFactorAuthenticatorSignInAsync(login.TwoFactorCode, isPersistent, rememberClient: isPersistent);
                }
                else if (!string.IsNullOrEmpty(login.TwoFactorRecoveryCode))
                {
                    result = await signInManager.TwoFactorRecoveryCodeSignInAsync(login.TwoFactorRecoveryCode);
                }
            }

            if (!result.Succeeded)
            {
                return Unauthorized(result.ToString());
            }

            return Ok();
        }

        [HttpPost("logout")]
        public async Task<IActionResult> SignOutAsync()
        {
            await this.signInManager.SignOutAsync();

            return Ok();
        }

        [HttpPost("forgotPassword")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPasswordAsync([FromBody] ForgotPasswordRequest resetRequest)
        {
            var user = await userManager.FindByEmailAsync(resetRequest.Email);

            if (user is not null && await userManager.IsEmailConfirmedAsync(user))
            {
                var code = await userManager.GeneratePasswordResetTokenAsync(user);
                code = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(code));

                await emailSender.SendPasswordResetCodeAsync(user, resetRequest.Email, HtmlEncoder.Default.Encode(code));
            }

            return Ok();
        }

        [HttpPost("resetPassword")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPasswordAsync([FromBody] ResetPasswordRequest resetRequest)
        {
            var user = await userManager.FindByEmailAsync(resetRequest.Email);

            if (user is null || !(await userManager.IsEmailConfirmedAsync(user)))
            {
                return this.ValidateResponse(IdentityResult.Failed(userManager.ErrorDescriber.InvalidToken()));
            }

            IdentityResult result;
            try
            {
                var code = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(resetRequest.ResetCode));
                result = await userManager.ResetPasswordAsync(user, code, resetRequest.NewPassword);
            }
            catch (FormatException)
            {
                result = IdentityResult.Failed(userManager.ErrorDescriber.InvalidToken());
            }

            if (!result.Succeeded)
            {
                return this.ValidateResponse(result);
            }

            return Ok();
        }

        [HttpPost("manage/info")]
        public async Task<IActionResult> UpdateUserInfoAsync([FromBody] InfoRequest infoRequest)
        {
            if (await this.userManager.GetUserAsync(this.HttpContext.User) is not { } user)
            {
                return NotFound();
            }

            if (!string.IsNullOrEmpty(infoRequest.NewEmail) && !emailAddressAttribute.IsValid(infoRequest.NewEmail))
            {
                return this.ValidateResponse(IdentityResult.Failed(userManager.ErrorDescriber.InvalidEmail(infoRequest.NewEmail)));
            }

            if (!string.IsNullOrEmpty(infoRequest.NewPassword))
            {
                if (string.IsNullOrEmpty(infoRequest.OldPassword))
                {
                    return this.ValidateResponse(AppResponse.Error(nameof(infoRequest.OldPassword), ValidationMessages.OldPasswordRequired), HttpStatusCode.OK);
                }

                var changePasswordResult = await userManager.ChangePasswordAsync(user, infoRequest.OldPassword, infoRequest.NewPassword);
                if (!changePasswordResult.Succeeded)
                {
                    return this.ValidateResponse(changePasswordResult);
                }
            }

            if (!string.IsNullOrEmpty(infoRequest.NewEmail))
            {
                var email = await userManager.GetEmailAsync(user);

                if (email != infoRequest.NewEmail)
                {
                    await SendConfirmationEmailAsync(user, HttpContext, infoRequest.NewEmail, true);
                }
            }

            return Ok(await CreateInfoResponseAsync(user, userManager));
        }

        [HttpPut("deactivate")]
        public async Task<IActionResult> DeactivateUserAsync()
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

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
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                BadRequest("User not found!");

            user.Enabled = true;

            await this.userManager.UpdateAsync(user);

            return Ok();
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchUsers([FromQuery] string searchTerm, [FromQuery] Guid? projectId, [FromServices] IAccessControlService accessControlService)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return Ok(new List<UserProjectResponseDTO>());
            }

            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            List<Guid> filterUsers = [user.Id];

            if (projectId.HasValue)
            {
                var projectUsers = await accessControlService.GetUsers(user, projectId.Value);

                if (projectUsers.Succeeded)
                    filterUsers.AddRange(projectUsers.Data.Where(u => u.UserId.HasValue).Select(u => u.UserId.Value));
            }

            searchTerm = Regex.Escape(searchTerm).ToLower();

            var users = userManager.Users
                .Where(u => !filterUsers.Contains(u.Id))
                .Where(u =>
                    u.FirstName.ToLower().Contains(searchTerm) ||
                    u.LastName.ToLower().Contains(searchTerm) ||
                    u.Email.ToLower().Contains(searchTerm))
                .OrderBy(u => u.FirstName)
                .Take(5)
                .Select(u => new UserProjectResponseDTO(u))
                .ToList();

            return Ok(users);
        }

        [HttpGet("confirmEmail")]
        [AllowAnonymous]
        public async Task<IActionResult> ConfirmEmailAsync([FromQuery] string userId, [FromQuery] string code, [FromQuery] string? changedEmail)
        {
            if (await userManager.FindByIdAsync(userId) is not { } user)
                return Unauthorized();

            try
            {
                code = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(code));
            }
            catch (FormatException)
            {
                return Unauthorized();
            }

            IdentityResult result;

            if (string.IsNullOrEmpty(changedEmail))
            {
                result = await userManager.ConfirmEmailAsync(user, code);
            }
            else
            {
                // As with Identity UI, email and user name are one and the same. So when we update the email,
                // we need to update the user name.
                result = await userManager.ChangeEmailAsync(user, changedEmail, code);

                if (result.Succeeded)
                {
                    result = await userManager.SetUserNameAsync(user, changedEmail);
                }
            }

            if (!result.Succeeded)
            {
                return Unauthorized();
            }

            return Ok("Thank you for confirming your email.");
        }

        private async Task SendConfirmationEmailAsync(User user, HttpContext context, string email, bool isChange = false)
        {
            var code = isChange
                ? await userManager.GenerateChangeEmailTokenAsync(user, email)
                : await userManager.GenerateEmailConfirmationTokenAsync(user);
            code = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(code));

            var userId = await userManager.GetUserIdAsync(user);
            var routeValues = new RouteValueDictionary()
            {
                ["userId"] = userId,
                ["code"] = code,
            };

            if (isChange)
            {
                // This is validated by the /confirmEmail endpoint on change.
                routeValues.Add("changedEmail", email);
            }

            var confirmEmailUrl = linkGenerator.GetUriByAction(context, nameof(ConfirmEmailAsync), "Account", routeValues)
                ?? throw new NotSupportedException($"Could not find endpoint named {nameof(ConfirmEmailAsync)}.");

            await emailSender.SendConfirmationLinkAsync(user, email, HtmlEncoder.Default.Encode(confirmEmailUrl));
        }

        private IActionResult ValidateResponse(IdentityResult identityResult)
        {
            var errorDictionary = new Dictionary<string, string[]>(1);

            foreach (var error in identityResult.Errors)
            {
                string[] newDescriptions;

                if (errorDictionary.TryGetValue(error.Code, out var descriptions))
                {
                    newDescriptions = new string[descriptions.Length + 1];
                    Array.Copy(descriptions, newDescriptions, descriptions.Length);
                    newDescriptions[descriptions.Length] = error.Description;
                }
                else
                {
                    newDescriptions = [error.Description];
                }

                errorDictionary[error.Code] = newDescriptions;
            }

            return BadRequest(errorDictionary);
        }

        private static async Task<InfoResponse> CreateInfoResponseAsync<TUser>(TUser user, UserManager<TUser> userManager)
            where TUser : class
        {
            return new()
            {
                Email = await userManager.GetEmailAsync(user) ?? throw new NotSupportedException("Users must have an email."),
                IsEmailConfirmed = await userManager.IsEmailConfirmedAsync(user),
            };
        }
    }
}
