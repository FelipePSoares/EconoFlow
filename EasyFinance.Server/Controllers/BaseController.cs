using System.Net;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Mvc;

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

        protected IActionResult ValidateResponse<T>(string actionName, object routeValues, AppResponse<T> appResponse)
        {
            if (appResponse.Failed)
                return this.ValidateResponse(appResponse);

            return CreatedAtAction(actionName: actionName, routeValues: routeValues, value: appResponse.Data);
        }

        private BadRequestObjectResult ValidateResponse(AppResponse appResponse)
            => BadRequest(new
            {
                errors = appResponse.Messages
                .GroupBy(m => m.Code)
                .ToDictionary(m => m.Key, m => m.Select(s => s.Description))
            });
    }
}
