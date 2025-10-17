using System.Net;
using System.Security.Claims;
using EasyFinance.Application.Features.UserKeyService;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Tags("Encryption")]
    [Route("api/[controller]")]
    public class EncryptionController(IUserKeyService userKeyService, ILogger<EncryptionController> logger) : BaseController
    {
        private readonly IUserKeyService userKeyService = userKeyService;
        private readonly ILogger<EncryptionController> logger = logger;

        [HttpGet("UserKey")]
        public IActionResult GetUserKey()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userIdClaim))
                return Unauthorized();

            var userKey = userKeyService.GenerateUserKey(userIdClaim);

            logger.LogInformation("Encryption key requested for user: {UserId}", userIdClaim);

            return ValidateResponse(userKey, HttpStatusCode.OK);
        }
    }
}
