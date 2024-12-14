using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace EasyFinance.Server.Controllers
{
    public class BaseController : ControllerBase
    {
        protected IActionResult ValidateResponse<T>(AppResponse<T> appResponse, HttpStatusCode successStatusCode)
        {
            if (appResponse.Succeeded)
                return StatusCode((int)successStatusCode, appResponse.Data);

            return ValidateResponse(appResponse);
        }

        protected IActionResult ValidateResponse(AppResponse appResponse, HttpStatusCode successStatusCode)
        {
            if (appResponse.Succeeded)
                return StatusCode((int)successStatusCode);

            return ValidateResponse(appResponse);
        }

        private IActionResult ValidateResponse(AppResponse appResponse)
        {
            if (appResponse.Messages.Any(message => message.Code == ValidationMessages.NotFound))
                return NotFound();

            if (appResponse.Messages.Any(message => message.Code == ValidationMessages.Forbidden))
                return Forbid();

            return BadRequest(appResponse.Messages);
        }
    }
}
