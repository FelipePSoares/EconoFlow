using System.Net;
using EasyFinance.Application.DTOs.Support;
using EasyFinance.Application.Features.SupportService;
using EasyFinance.Application.Mappers;

using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public class SupportController : BaseController
    {
        private readonly IContactService contactUsService;

        public SupportController(
            IContactService contactUsService)
        {
            this.contactUsService= contactUsService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateMessage([FromBody] ContactUsRequestDTO contactUsDto)
        {
            if (contactUsDto == null) return BadRequest();

            var createdMessage = await contactUsService.CreateAsync(contactUsDto.FromDTO());

            return ValidateResponse(actionName: nameof(GetById), routeValues: new { messageId = Guid.Empty }, appResponse: 
            createdMessage);
        }

        public IActionResult GetById(Guid messageId) 
        {
            var message = contactUsService.GetById(messageId);

            if (message == null) return NotFound();

            return ValidateResponse(message, HttpStatusCode.OK);
        }
    }
}
