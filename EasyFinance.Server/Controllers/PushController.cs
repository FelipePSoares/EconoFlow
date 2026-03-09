using System;
using System.Linq;
using System.Net;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Application.Features.WebPushService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.DTOs;
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
        UserManager<User> userManager,
        IFeatureRolloutService featureRolloutService) : BaseController
    {
        [HttpGet("public-key")]
        public async Task<IActionResult> GetPublicKeyAsync()
        {
            var user = await userManager.GetUserAsync(HttpContext.User);
            if (user == null)
                return BadRequest("User not found!");

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
                return BadRequest("User not found!");

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
                return BadRequest("User not found!");

            var response = await webPushService.UnsubscribeAsync(user.Id, request?.Endpoint ?? string.Empty, cancellationToken);
            if (HasForbiddenError(response))
                return Forbid();

            return ValidateResponse(response, HttpStatusCode.NoContent);
        }

        private static bool HasForbiddenError(AppResponse response)
            => response.Messages.Any(message => string.Equals(message.Code, "forbidden", StringComparison.OrdinalIgnoreCase));
    }
}
