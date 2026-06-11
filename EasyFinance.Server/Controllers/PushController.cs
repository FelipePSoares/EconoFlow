using System;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.Features.ExpoPushTokenService;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Application.Features.WebPushService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Tags("Push")]
    [Route("api/[controller]")]
    [Route("[controller]")]
    public class PushController(
        IWebPushService webPushService,
        IExpoPushTokenService expoPushTokenService,
        UserManager<User> userManager,
        IFeatureRolloutService featureRolloutService) : BaseController
    {
        [HttpGet("public-key")]
        public async Task<IActionResult> GetPublicKeyAsync()
        {
            var user = await userManager.GetUserAsync(HttpContext.User);
            if (user == null)
                return BadRequest(ValidationMessages.UserNotFound);

            var roles = await userManager.GetRolesAsync(user);
            if (!featureRolloutService.IsEnabled(roles, FeatureFlags.WebPush))
                return Forbid();

            var response = webPushService.GetPublicKey();
            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpPost("subscribe")]
        public async Task<IActionResult> SubscribeAsync([FromBody] WebPushSubscriptionRequestDTO request, CancellationToken cancellationToken)
        {
            var user = await userManager.GetUserAsync(HttpContext.User);
            if (user == null)
                return BadRequest(ValidationMessages.UserNotFound);

            var roles = await userManager.GetRolesAsync(user);
            if (!featureRolloutService.IsEnabled(roles, FeatureFlags.WebPush))
                return Forbid();

            var response = await webPushService.UpsertSubscriptionAsync(user.Id, request, cancellationToken);
            if (HasForbiddenError(response))
                return Forbid();

            return ValidateResponse(response, HttpStatusCode.NoContent);
        }

        [HttpDelete("unsubscribe")]
        public async Task<IActionResult> UnsubscribeAsync([FromBody] WebPushUnsubscribeRequestDTO request, CancellationToken cancellationToken)
        {
            var user = await userManager.GetUserAsync(HttpContext.User);
            if (user == null)
                return BadRequest(ValidationMessages.UserNotFound);

            var response = await webPushService.UnsubscribeAsync(user.Id, request?.Endpoint ?? string.Empty, cancellationToken);
            if (HasForbiddenError(response))
                return Forbid();

            return ValidateResponse(response, HttpStatusCode.NoContent);
        }

        [HttpPost("expo/register")]
        public async Task<IActionResult> RegisterExpoTokenAsync([FromBody] ExpoPushTokenRequestDTO request, CancellationToken cancellationToken)
        {
            var user = await userManager.GetUserAsync(HttpContext.User);
            if (user == null)
                return BadRequest(ValidationMessages.UserNotFound);

            var response = await expoPushTokenService.UpsertTokenAsync(user.Id, request?.Token ?? string.Empty, request?.DeviceName);
            return ValidateResponse(response, HttpStatusCode.NoContent);
        }

        [HttpDelete("expo/unregister")]
        public async Task<IActionResult> UnregisterExpoTokenAsync([FromBody] ExpoPushTokenRequestDTO request, CancellationToken cancellationToken)
        {
            var user = await userManager.GetUserAsync(HttpContext.User);
            if (user == null)
                return BadRequest(ValidationMessages.UserNotFound);

            var response = await expoPushTokenService.RevokeTokenAsync(user.Id, request?.Token ?? string.Empty);
            if (HasForbiddenError(response))
                return Forbid();

            return ValidateResponse(response, HttpStatusCode.NoContent);
        }

        private static bool HasForbiddenError(AppResponse response)
            => response.Messages.Any(message => string.Equals(message.Code, "forbidden", StringComparison.OrdinalIgnoreCase));
    }
}
