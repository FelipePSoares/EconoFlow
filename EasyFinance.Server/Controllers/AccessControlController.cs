using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Application.Features.UserService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Authentication;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Server.Config;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Serilog;


namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Tags("AccessControl")]
    [Route("api/[controller]")]
    public class AccessControlController(
        UserManager<User> userManager,
        SignInManager<User> signInManager,
        IEmailSender<User> emailSender,
        IUserService userService,
        LinkGenerator linkGenerator,
        IAccessControlService accessControlService,
        TokenSettings tokenSettings,
        INotificationService notificationService,
        ILogger<AccessControlController> logger) : BaseController
    {
        private readonly string tokenProvider = "REFRESHTOKENPROVIDER";
        private readonly string tokenPurpose = "RefreshToken";
        private readonly string refreshTokenCookieName = "RefreshToken";
        private readonly string accessTokenCookieName = "AuthToken";
        private readonly string correlationIdClaimType = "CorrelationId";
        private const double refreshTokenSlowThresholdMs = 250;
        private const int twoFactorRecoveryCodeAmount = 10;
        private const string twoFactorAuthenticatorIssuer = "EconoFlow";
        private const string loginFailureCodeInvalidCredentials = "InvalidCredentials";
        private const string loginFailureCodeTwoFactorRequired = "TwoFactorRequired";
        private const string loginFailureCodeInvalidTwoFactorCode = "InvalidTwoFactorCode";
        private const string loginFailureCodeInvalidTwoFactorRecoveryCode = "InvalidTwoFactorRecoveryCode";

        // Validate the email address using DataAnnotations like the UserValidator does when RequireUniqueEmail = true.
        private static readonly EmailAddressAttribute emailAddressAttribute = new();

        private readonly UserManager<User> userManager = userManager;
        private readonly SignInManager<User> signInManager = signInManager;
        private readonly IEmailSender<User> emailSender = emailSender;
        private readonly IUserService userService = userService;
        private readonly LinkGenerator linkGenerator = linkGenerator;
        private readonly IAccessControlService accessControlService = accessControlService;
        private readonly TokenSettings tokenSettings = tokenSettings;
        private readonly INotificationService notificationService = notificationService;
        private readonly ILogger<AccessControlController> logger = logger;

        [HttpGet]
        public async Task<IActionResult> GetUserAsync()
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                return BadRequest("User not found!");

            return Ok(new UserResponseDTO(user));
        }

        [HttpGet("IsLogged")]
        [AllowAnonymous]
        public IActionResult CheckStatus()
        {
            if (!this.HttpContext.User.Identity.IsAuthenticated)
                return Ok(false);

            return Ok(true);
        }

        [HttpPatch]
        public async Task<IActionResult> PatchUserAsync([FromBody] JsonPatchDocument<UserRequestDTO> userRequestDto)
        {
            if (userRequestDto == null) return BadRequest();

            var existentUser = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (existentUser == null)
                return BadRequest("User not found!");

            var dto = existentUser.ToRequestDTO();
            userRequestDto.ApplyTo(dto);

            existentUser.SetFirstName(dto.FirstName);
            existentUser.SetLastName(dto.LastName);
            existentUser.SetLanguageCode(dto.LanguageCode);
            existentUser.SetNotificationChannels(dto.NotificationChannels);

            var result = existentUser.Validate;
            if (result.Failed)
                return this.ValidateResponse(result, HttpStatusCode.OK);

            await this.userManager.UpdateAsync(existentUser);

            return Ok(new UserResponseDTO(existentUser));
        }

        [HttpPut("default-project/{defaultProjectId?}")]
        public async Task<IActionResult> SetDefaultProject(Guid? defaultProjectId = null)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                return BadRequest("User not found!");

            var result = await this.userService.SetDefaultProjectAsync(user, defaultProjectId);

            return ValidateResponse(result, HttpStatusCode.OK);
        }

        [HttpDelete]
        public async Task<IActionResult> DeleteUserAsync([FromBody] UserDeleteRequestDTO request = null)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                return BadRequest("User not found!");

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
                throw new NotSupportedException($"{nameof(AccessControlController)} requires a user store with email support.");

            var emailStore = (IUserEmailStore<User>)userStore;
            var email = registration.Email;

            if (string.IsNullOrEmpty(email) || !emailAddressAttribute.IsValid(email))
            {
                var error = userManager.ErrorDescriber.InvalidEmail(email);
                return this.ValidateResponse(AppResponse.Error(error.Code, error.Description), HttpStatusCode.OK);
            }

            var user = new User();
            user.SetLanguageCode(CultureInfo.CurrentUICulture.Name);
            await userStore.SetUserNameAsync(user, email, CancellationToken.None);
            await emailStore.SetEmailAsync(user, email, CancellationToken.None);
            user.SetNotificationChannels(NotificationChannels.Push | NotificationChannels.Email);
            var result = await userManager.CreateAsync(user, registration.Password);

            if (!result.Succeeded)
            {
                return this.ValidateIdentityResponse(result);
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

            var confirmEmailNotification = new NotificationRequestDTO
            {
                User = user,
                CodeMessage = "ConfirmEmailMessage",
                Type = NotificationType.EmailConfirmation,
                Category = NotificationCategory.Security,
                ActionLabelCode = "ButtonConfirmEmail",
                IsActionRequired = true,
                LimitNotificationChannels = NotificationChannels.InApp,
                IsSticky = true
            };
            var confirmNotificationResult = await this.notificationService.CreateNotificationAsync(confirmEmailNotification);

            if (confirmNotificationResult.Failed)
                this.logger.LogWarning("Failed to create email confirmation notification for user {UserId}: {Errors}", user.Id, string.Join(", ", confirmNotificationResult.Messages.Select(m => m.Description)));

            var welcomeNotification = new NotificationRequestDTO
            {
                User = user,
                CodeMessage = "WelcomeMessage",
                Type = NotificationType.Information,
                Category = NotificationCategory.System
            };

            var welcomeNotificationResult = await this.notificationService.CreateNotificationAsync(welcomeNotification);

            if (welcomeNotificationResult.Failed)
                this.logger.LogWarning("Failed to create welcome notification for user {UserId}: {Errors}", user.Id, string.Join(", ", welcomeNotificationResult.Messages.Select(m => m.Description)));

            var twoFactorRecommendationNotification = new NotificationRequestDTO
            {
                User = user,
                CodeMessage = "EnableTwoFactorRecommendationMessage",
                Type = NotificationType.Information,
                Category = NotificationCategory.Security,
                ActionLabelCode = "ButtonConfigureTwoFactor",
                LimitNotificationChannels = NotificationChannels.InApp,
                IsSticky = false
            };

            var twoFactorRecommendationResult = await this.notificationService.CreateNotificationAsync(twoFactorRecommendationNotification);

            if (twoFactorRecommendationResult.Failed)
                this.logger.LogWarning("Failed to create two-factor recommendation notification for user {UserId}: {Errors}", user.Id, string.Join(", ", twoFactorRecommendationResult.Messages.Select(m => m.Description)));
             
            var correlationId = HttpContext.Items[correlationIdClaimType].ToString();

            await GenerateUserToken(user, correlationId);

            return Ok();
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> SignInAsync([FromBody] SignInRequestDTO login)
        {
            var user = await userManager.FindByEmailAsync(login.Email);

            if (user == null || !user.Enabled)
                return Unauthorized(CreateLoginFailureResponse(loginFailureCodeInvalidCredentials));

            var result = await signInManager.CheckPasswordSignInAsync(user, login.Password, lockoutOnFailure: true);

            if (result.IsLockedOut)
                return Unauthorized("LockedOut");

            if (!result.Succeeded && !result.RequiresTwoFactor)
                return Unauthorized(CreateLoginFailureResponse(loginFailureCodeInvalidCredentials));

            var userHasTwoFactorEnabled = await this.userManager.GetTwoFactorEnabledAsync(user);
            var requiresTwoFactor = result.RequiresTwoFactor || (result.Succeeded && userHasTwoFactorEnabled);

            if (requiresTwoFactor && string.IsNullOrWhiteSpace(login.TwoFactorCode) && string.IsNullOrWhiteSpace(login.TwoFactorRecoveryCode))
                return Unauthorized(CreateLoginFailureResponse(loginFailureCodeTwoFactorRequired, requiresTwoFactor: true));

            if (requiresTwoFactor)
            {
                if (!string.IsNullOrWhiteSpace(login.TwoFactorCode))
                {
                    var normalizedCode = NormalizeTwoFactorCode(login.TwoFactorCode);
                    var isTwoFactorCodeValid = await this.userManager.VerifyTwoFactorTokenAsync(
                        user,
                        this.userManager.Options.Tokens.AuthenticatorTokenProvider,
                        normalizedCode);

                    if (!isTwoFactorCodeValid)
                        return Unauthorized(CreateLoginFailureResponse(loginFailureCodeInvalidTwoFactorCode, requiresTwoFactor: true));
                }
                else if (!string.IsNullOrWhiteSpace(login.TwoFactorRecoveryCode))
                {
                    var recoveryCodeSignInResult = await this.userManager.RedeemTwoFactorRecoveryCodeAsync(user, NormalizeRecoveryCode(login.TwoFactorRecoveryCode));

                    if (!recoveryCodeSignInResult.Succeeded)
                        return Unauthorized(CreateLoginFailureResponse(loginFailureCodeInvalidTwoFactorRecoveryCode, requiresTwoFactor: true));
                }
            }

            var correlationId = HttpContext.Items[correlationIdClaimType].ToString();

            await GenerateUserToken(user, correlationId);

            return Ok();
        }

        [HttpGet("2fa/setup")]
        public async Task<IActionResult> GetTwoFactorSetupAsync()
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                return BadRequest("User not found!");

            var unformattedKey = await this.userManager.GetAuthenticatorKeyAsync(user);

            if (string.IsNullOrWhiteSpace(unformattedKey))
            {
                var resetAuthenticatorResult = await this.userManager.ResetAuthenticatorKeyAsync(user);

                if (!resetAuthenticatorResult.Succeeded)
                    return this.ValidateIdentityResponse(resetAuthenticatorResult);

                unformattedKey = await this.userManager.GetAuthenticatorKeyAsync(user);
            }

            if (string.IsNullOrWhiteSpace(unformattedKey))
                return this.ValidateResponse(AppResponse.Error(nameof(TwoFactorSetupResponseDTO.SharedKey), ValidationMessages.FailedToGenerateAuthenticatorKey), HttpStatusCode.OK);

            var email = await this.userManager.GetEmailAsync(user) ?? user.Email ?? user.UserName ?? user.Id.ToString();

            return Ok(new TwoFactorSetupResponseDTO
            {
                IsTwoFactorEnabled = await this.userManager.GetTwoFactorEnabledAsync(user),
                SharedKey = FormatKey(unformattedKey),
                OtpAuthUri = GenerateOtpAuthUri(email, unformattedKey),
            });
        }

        [HttpPost("2fa/enable")]
        public async Task<IActionResult> EnableTwoFactorAsync([FromBody] TwoFactorEnableRequestDTO request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Code))
                return this.ValidateResponse(AppResponse.Error(
                    nameof(TwoFactorEnableRequestDTO.Code),
                    string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(TwoFactorEnableRequestDTO.Code))),
                    HttpStatusCode.OK);

            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                return BadRequest("User not found!");

            var isTwoFactorCodeValid = await this.userManager.VerifyTwoFactorTokenAsync(
                user,
                this.userManager.Options.Tokens.AuthenticatorTokenProvider,
                NormalizeTwoFactorCode(request.Code));

            if (!isTwoFactorCodeValid)
                return this.ValidateResponse(AppResponse.Error(nameof(TwoFactorEnableRequestDTO.Code), ValidationMessages.InvalidAuthenticatorCode), HttpStatusCode.OK);

            var setTwoFactorResult = await this.userManager.SetTwoFactorEnabledAsync(user, true);

            if (!setTwoFactorResult.Succeeded)
                return this.ValidateIdentityResponse(setTwoFactorResult);

            var recoveryCodes = await this.userManager.GenerateNewTwoFactorRecoveryCodesAsync(user, twoFactorRecoveryCodeAmount);

            return Ok(new TwoFactorEnableResponseDTO
            {
                TwoFactorEnabled = true,
                RecoveryCodes = recoveryCodes.ToArray()
            });
        }

        [HttpPost("2fa/disable")]
        public async Task<IActionResult> DisableTwoFactorAsync([FromBody] TwoFactorSecureActionRequestDTO request)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                return BadRequest("User not found!");

            if (!await this.userManager.GetTwoFactorEnabledAsync(user))
                return this.ValidateResponse(AppResponse.Error("general", ValidationMessages.TwoFactorNotEnabled), HttpStatusCode.OK);

            var validationResponse = await this.ValidateSecureTwoFactorActionAsync(user, request);

            if (validationResponse.Failed)
                return this.ValidateResponse(validationResponse, HttpStatusCode.OK);

            var disableTwoFactorResult = await this.userManager.SetTwoFactorEnabledAsync(user, false);

            if (!disableTwoFactorResult.Succeeded)
                return this.ValidateIdentityResponse(disableTwoFactorResult);

            return Ok(new TwoFactorStatusResponseDTO
            {
                TwoFactorEnabled = false
            });
        }

        [HttpPost("2fa/recovery-codes/regenerate")]
        public async Task<IActionResult> RegenerateTwoFactorRecoveryCodesAsync([FromBody] TwoFactorSecureActionRequestDTO request)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user == null)
                return BadRequest("User not found!");

            if (!await this.userManager.GetTwoFactorEnabledAsync(user))
                return this.ValidateResponse(AppResponse.Error("general", ValidationMessages.TwoFactorNotEnabled), HttpStatusCode.OK);

            var validationResponse = await this.ValidateSecureTwoFactorActionAsync(user, request);

            if (validationResponse.Failed)
                return this.ValidateResponse(validationResponse, HttpStatusCode.OK);

            var recoveryCodes = await this.userManager.GenerateNewTwoFactorRecoveryCodesAsync(user, twoFactorRecoveryCodeAmount);

            return Ok(new TwoFactorRecoveryCodesResponseDTO
            {
                RecoveryCodes = recoveryCodes.ToArray()
            });
        }

        [HttpPost("refresh-token")]
        [AllowAnonymous]
        public async Task<IActionResult> RefreshTokenAsync()
        {
            var refreshStopwatch = Stopwatch.StartNew();
            var stageStopwatch = Stopwatch.StartNew();
            var result = "success";
            var reason = "none";
            var parseAccessTokenMs = 0d;
            var loadRefreshContextMs = 0d;
            var verifyRefreshTokenMs = 0d;
            var issueTokensMs = 0d;

            try
            {
                var accessToken = this.GetAccessTokenFromCookie();

                if (string.IsNullOrEmpty(accessToken))
                {
                    result = "unauthorized";
                    reason = "missing_access_token";
                    return Unauthorized();
                }

                ClaimsPrincipal principal;
                try
                {
                    principal = TokenUtil.GetPrincipalFromExpiredToken(this.tokenSettings, accessToken);
                }
                catch (Exception ex)
                {
                    this.logger.LogDebug(ex, "Invalid access token during refresh token flow.");
                    result = "unauthorized";
                    reason = "invalid_access_token";
                    return Unauthorized();
                }

                var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var parsedUserId))
                {
                    result = "unauthorized";
                    reason = "missing_user_id_claim";
                    return Unauthorized();
                }

                parseAccessTokenMs = stageStopwatch.Elapsed.TotalMilliseconds;
                stageStopwatch.Restart();

                var refreshContext = await this.accessControlService.GetRefreshTokenContextAsync(parsedUserId);
                loadRefreshContextMs = stageStopwatch.Elapsed.TotalMilliseconds;
                stageStopwatch.Restart();

                if (refreshContext == null || !refreshContext.User.Enabled)
                {
                    result = "unauthorized";
                    reason = "invalid_user";
                    return Unauthorized();
                }

                var refreshToken = this.GetRefreshTokenFromCookie();

                if (string.IsNullOrEmpty(refreshToken))
                {
                    result = "unauthorized";
                    reason = "missing_refresh_token";
                    return Unauthorized();
                }

                if (!await this.userManager.VerifyUserTokenAsync(refreshContext.User, this.tokenProvider, this.tokenPurpose, refreshToken))
                {
                    result = "unauthorized";
                    reason = "invalid_refresh_token";
                    return Unauthorized();
                }

                verifyRefreshTokenMs = stageStopwatch.Elapsed.TotalMilliseconds;
                stageStopwatch.Restart();

                var correlationId = principal.Claims.Where(c => c.Type == correlationIdClaimType)
                                   .Select(c => c.Value).SingleOrDefault();

                await GenerateUserToken(refreshContext.User, correlationId, refreshContext.Roles);
                issueTokensMs = stageStopwatch.Elapsed.TotalMilliseconds;

                return Ok();
            }
            finally
            {
                var elapsedMs = refreshStopwatch.Elapsed.TotalMilliseconds;

                if (elapsedMs >= refreshTokenSlowThresholdMs)
                {
                    this.logger.LogWarning(
                        "Slow refresh token request detected: {ElapsedMs}ms. Result: {Result}. Reason: {Reason}. ParseAccessTokenMs: {ParseAccessTokenMs}. LoadRefreshContextMs: {LoadRefreshContextMs}. VerifyRefreshTokenMs: {VerifyRefreshTokenMs}. IssueTokensMs: {IssueTokensMs}.",
                        elapsedMs,
                        result,
                        reason,
                        parseAccessTokenMs,
                        loadRefreshContextMs,
                        verifyRefreshTokenMs,
                        issueTokensMs);
                }
                else
                {
                    this.logger.LogInformation(
                        "Refresh token request completed in {ElapsedMs}ms. Result: {Result}. ParseAccessTokenMs: {ParseAccessTokenMs}. LoadRefreshContextMs: {LoadRefreshContextMs}. VerifyRefreshTokenMs: {VerifyRefreshTokenMs}. IssueTokensMs: {IssueTokensMs}.",
                        elapsedMs,
                        result,
                        parseAccessTokenMs,
                        loadRefreshContextMs,
                        verifyRefreshTokenMs,
                        issueTokensMs);
                }
            }
        }

        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> SignOutAsync()
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            if (user != null)
                await this.userManager.RemoveAuthenticationTokenAsync(user, this.tokenProvider, this.tokenPurpose);

            Response.Cookies.Delete(refreshTokenCookieName);
            Response.Cookies.Delete(accessTokenCookieName);

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
                return this.ValidateIdentityResponse(IdentityResult.Failed(userManager.ErrorDescriber.InvalidToken()));
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
                return this.ValidateIdentityResponse(result);
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
                return this.ValidateIdentityResponse(IdentityResult.Failed(userManager.ErrorDescriber.InvalidEmail(infoRequest.NewEmail)));
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
                    return this.ValidateIdentityResponse(changePasswordResult);
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
                return BadRequest("User not found!");

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
                return BadRequest("User not found!");

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

            var knowUsers = await accessControlService.GetAllKnowUsersAsync(user, projectId);

            if (!knowUsers.Succeeded)
                return this.ValidateResponse(knowUsers, HttpStatusCode.OK);

            searchTerm = Regex.Escape(searchTerm);

            var users = knowUsers.Data
                .Where(u => !filterUsers.Contains(u.Id))
                .Where(u =>
                    u.FirstName.Contains(searchTerm, StringComparison.InvariantCultureIgnoreCase) ||
                    u.LastName.Contains(searchTerm, StringComparison.InvariantCultureIgnoreCase) ||
                    u.Email.Contains(searchTerm, StringComparison.InvariantCultureIgnoreCase))
                .OrderBy(u => u.FirstName)
                .Take(5)
                .ToSearchResponseDTO()
                .ToList();

            return Ok(users);
        }

        [HttpGet("confirmEmail")]
        [AllowAnonymous]
        public async Task<IActionResult> ConfirmEmailAsync([FromQuery] string userId, [FromQuery] string code, [FromQuery] string? changedEmail)
        {
            if (string.IsNullOrEmpty(userId))
                throw new ArgumentException(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(userId)));

            if (string.IsNullOrEmpty(code))
                throw new ArgumentException(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(code)));

            if (await userManager.FindByIdAsync(userId) is not { } user)
                return Unauthorized();

            try
            {
                code = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(code));
            }
            catch (FormatException)
            {
                this.logger.LogWarning($"Invalid code format for user {userId.Replace(Environment.NewLine, "").Replace("\n", "").Replace("\r", "")}.");
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
                    result = await userManager.SetUserNameAsync(user, changedEmail);
            }

            if (!result.Succeeded)
                return Unauthorized();

            await this.notificationService.ActionMadeAsync(user.Id, NotificationType.EmailConfirmation);
            Response.Headers.Append("Refresh", $"5;url={Request.Scheme}://{Request.Host}");
            return Content(ValidationMessages.ThankYouConfirmEmailRedirect);
        }

        [HttpPost("resendConfirmEmail")]
        public async Task<IActionResult> ResendConfirmationEmail()
        {
            if (await this.userManager.GetUserAsync(this.HttpContext.User) is not { } user)
                return NotFound();

            // Check if already confirmed
            if (await userManager.IsEmailConfirmedAsync(user))
                return BadRequest("This email is already confirmed.");

            await SendConfirmationEmailAsync(user, HttpContext, user.Email);

            return Ok();
        }

        [HttpGet("unsubscribe")]
        [AllowAnonymous]
        public async Task<IActionResult> UnsubscribeFromEmailNotificationsAsync([FromQuery] Guid userId, [FromQuery] string signature)
        {
            var user = await this.userManager.FindByIdAsync(userId.ToString());
            this.logger.LogInformation("Email unsubscribe endpoint called for user {UserId}.", userId);

            if (userId == Guid.Empty || string.IsNullOrWhiteSpace(signature))
            {
                this.logger.LogWarning("Email unsubscribe request rejected due to missing userId/signature for user {UserId}.", userId);
                return BadRequest("Invalid unsubscribe request.");
            }

            if (!this.userService.ValidateUnsubscribeSignature(userId, signature))
            {
                this.logger.LogWarning("Email unsubscribe request rejected due to invalid signature for user {UserId}.", userId);
                return BadRequest("Invalid unsubscribe request.");
            }

            var response = await this.userService.UnsubscribeFromEmailNotificationsAsync(userId);

            if (response.Failed)
            {
                this.logger.LogWarning("Failed to unsubscribe email notifications for user {UserId}: {Errors}", userId, string.Join(", ", response.Messages.Select(message => message.Description)));
                return this.ValidateResponse(response, HttpStatusCode.OK);
            }

            this.logger.LogInformation("Email notifications unsubscribed for user {UserId}.", userId);
            return Content("You have been unsubscribed from email notifications.");
        }

        private async Task<AppResponse> ValidateSecureTwoFactorActionAsync(User user, TwoFactorSecureActionRequestDTO request)
        {
            if (request == null)
                return AppResponse.Error(
                    nameof(TwoFactorSecureActionRequestDTO.Password),
                    string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(TwoFactorSecureActionRequestDTO.Password)));

            if (string.IsNullOrWhiteSpace(request.Password))
                return AppResponse.Error(
                    nameof(TwoFactorSecureActionRequestDTO.Password),
                    string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(TwoFactorSecureActionRequestDTO.Password)));

            if (!await this.userManager.CheckPasswordAsync(user, request.Password))
                return AppResponse.Error(nameof(TwoFactorSecureActionRequestDTO.Password), ValidationMessages.InvalidPassword);

            if (string.IsNullOrWhiteSpace(request.TwoFactorCode) && string.IsNullOrWhiteSpace(request.TwoFactorRecoveryCode))
                return AppResponse.Error("general", ValidationMessages.TwoFactorCodeOrRecoveryCodeRequired);

            if (!string.IsNullOrWhiteSpace(request.TwoFactorCode))
            {
                var isTwoFactorCodeValid = await this.userManager.VerifyTwoFactorTokenAsync(
                    user,
                    this.userManager.Options.Tokens.AuthenticatorTokenProvider,
                    NormalizeTwoFactorCode(request.TwoFactorCode));

                if (!isTwoFactorCodeValid)
                    return AppResponse.Error(nameof(TwoFactorSecureActionRequestDTO.TwoFactorCode), ValidationMessages.InvalidAuthenticatorCode);

                return AppResponse.Success();
            }

            var recoveryCodeResult = await this.userManager.RedeemTwoFactorRecoveryCodeAsync(user, NormalizeRecoveryCode(request.TwoFactorRecoveryCode));

            if (!recoveryCodeResult.Succeeded)
                return AppResponse.Error(nameof(TwoFactorSecureActionRequestDTO.TwoFactorRecoveryCode), ValidationMessages.InvalidRecoveryCode);

            return AppResponse.Success();
        }

        private static LoginFailureResponseDTO CreateLoginFailureResponse(string code, bool requiresTwoFactor = false)
            => new()
            {
                Code = code,
                RequiresTwoFactor = requiresTwoFactor
            };

        private static string NormalizeTwoFactorCode(string code)
            => (code ?? string.Empty).Replace(" ", string.Empty).Replace("-", string.Empty);

        private static string NormalizeRecoveryCode(string code)
            => (code ?? string.Empty).Replace(" ", string.Empty);

        private static string FormatKey(string unformattedKey)
        {
            var builder = new StringBuilder();
            var currentPosition = 0;

            while (currentPosition + 4 < unformattedKey.Length)
            {
                builder.Append(unformattedKey.AsSpan(currentPosition, 4)).Append(' ');
                currentPosition += 4;
            }

            if (currentPosition < unformattedKey.Length)
                builder.Append(unformattedKey.AsSpan(currentPosition));

            return builder.ToString().ToLowerInvariant();
        }

        private static string GenerateOtpAuthUri(string email, string unformattedKey)
            => string.Format(
                CultureInfo.InvariantCulture,
                "otpauth://totp/{0}:{1}?secret={2}&issuer={0}&digits=6",
                UrlEncoder.Default.Encode(twoFactorAuthenticatorIssuer),
                UrlEncoder.Default.Encode(email),
                UrlEncoder.Default.Encode(unformattedKey));

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

            var confirmEmailUrl = linkGenerator.GetUriByAction(context, nameof(ConfirmEmailAsync), nameof(AccessControlController).Replace("Controller", string.Empty), routeValues)
                ?? throw new NotSupportedException($"Could not find endpoint named {nameof(ConfirmEmailAsync)}.");

            await emailSender.SendConfirmationLinkAsync(user, email, HtmlEncoder.Default.Encode(confirmEmailUrl));
        }

        private IActionResult ValidateIdentityResponse(IdentityResult identityResult)
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

                errorDictionary[error.Code == "DuplicateEmail" ? "Email" : error.Code] = newDescriptions;
            }

            return BadRequest(new { errors = errorDictionary });
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

        private async Task GenerateUserToken(User user, string correlationId = null, IList<string> roleNames = null)
        {
            var (AccessToken, RefreshToken) = await this.GenerateTokenAsync(user, correlationId, roleNames);

            SetAccessTokenCookie(AccessToken);
            SetRefreshTokenCookie(RefreshToken);
        }

        private async Task<(string AccessToken, string RefreshToken)> GenerateTokenAsync(User user, string correlationId, IList<string> roleNames = null)
        {
            var userRoles = roleNames ?? await this.userManager.GetRolesAsync(user);
            var claims = userRoles.Select(userRole => new Claim(ClaimTypes.Role, userRole)).ToList();
            claims.Add(new Claim(correlationIdClaimType, correlationId ?? Guid.NewGuid().ToString(), ClaimValueTypes.String));

            var token = TokenUtil.GetToken(tokenSettings, user, claims);
            var refreshToken = await userManager.GenerateUserTokenAsync(user, this.tokenProvider, this.tokenPurpose);
            await userManager.SetAuthenticationTokenAsync(user, this.tokenProvider, this.tokenPurpose, refreshToken);

            return (AccessToken: token, RefreshToken: refreshToken);
        }

        private void SetRefreshTokenCookie(string refreshToken)
        {
            var cookieOptions = new CookieOptions
            {
                Path = Url.Action(nameof(RefreshTokenAsync), nameof(AccessControlController).Replace("Controller", "")),
                Expires = DateTimeOffset.Now.AddSeconds(tokenSettings.RefreshTokenExpireSeconds)
            };

#if !DEBUG
            cookieOptions.HttpOnly = true;
            cookieOptions.Secure = true;
            cookieOptions.SameSite = SameSiteMode.Strict;
#endif

            Response.Cookies.Append(refreshTokenCookieName, refreshToken, cookieOptions);
        }

        private string GetRefreshTokenFromCookie() => Request.Cookies[refreshTokenCookieName] ?? string.Empty;

        private void SetAccessTokenCookie(string accessToken)
        {
            var cookieOptions = new CookieOptions
            {
                // Keep the access token for the same duration as the refresh token to be possible get the user by the expired access token. The limitation is the JWT lifetime.
                Expires = DateTimeOffset.Now.AddSeconds(tokenSettings.RefreshTokenExpireSeconds)
            };

#if !DEBUG
            cookieOptions.HttpOnly = true;
            cookieOptions.Secure = true;
            cookieOptions.SameSite = SameSiteMode.Strict;
#endif

            Response.Cookies.Append(accessTokenCookieName, accessToken, cookieOptions);
        }

        private string GetAccessTokenFromCookie() => Request.Cookies[accessTokenCookieName] ?? string.Empty;
    }
}

