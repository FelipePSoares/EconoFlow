using System.Net;
using System.Security.Claims;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Application.Features.WebPushService;
using EasyFinance.Domain.Account;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Tags("Account")]
    [Route("api/[controller]")]
    public class AccountController : BaseController
    {
        private readonly INotificationService notificationService;
        private readonly IWebPushService webPushService;

        public AccountController(
            INotificationService notificationService,
            IWebPushService webPushService)
        {
            this.notificationService = notificationService;
            this.webPushService = webPushService;
        }

        [HttpGet("Notifications")]
        public async Task<IActionResult> GetNotificationsAsync([FromQuery] NotificationCategory category = NotificationCategory.None)
        {
            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);

            var notifications = await this.notificationService.GetUnreadAsync(userId, category);

            return this.ValidateResponse(notifications, HttpStatusCode.OK);
        }

        [HttpPost("Notifications/{notificationId:guid}/read")]
        public async Task<IActionResult> MarkNotificationAsReadAsync([FromRoute] Guid notificationId)
        {
            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);

            var response = await this.notificationService.MarkAsReadAsync(userId, notificationId);

            return this.ValidateResponse(response, HttpStatusCode.NoContent);
        }

        [HttpPost("Notifications/read-all")]
        public async Task<IActionResult> MarkAllNotificationsAsReadAsync()
        {
            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);

            var response = await this.notificationService.MarkAllAsReadAsync(userId);

            return this.ValidateResponse(response, HttpStatusCode.NoContent);
        }

        [HttpGet("WebPush/PublicKey")]
        public IActionResult GetWebPushPublicKey()
        {
            var response = this.webPushService.GetPublicKey();
            return this.ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpPost("WebPush/Subscriptions")]
        public async Task<IActionResult> UpsertWebPushSubscriptionAsync([FromBody] WebPushSubscriptionRequestDTO request, CancellationToken cancellationToken)
        {
            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);
            var response = await this.webPushService.UpsertSubscriptionAsync(userId, request, cancellationToken);
            return this.ValidateResponse(response, HttpStatusCode.NoContent);
        }

        [HttpPost("WebPush/Test")]
        public async Task<IActionResult> SendWebPushTestNotificationAsync(CancellationToken cancellationToken)
        {
            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);
            var response = await this.webPushService.SendTestNotificationAsync(userId, cancellationToken);
            return this.ValidateResponse(response, HttpStatusCode.NoContent);
        }
    }
}
