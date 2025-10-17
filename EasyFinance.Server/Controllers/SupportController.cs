using System.Net;
using EasyFinance.Application.DTOs.Support;
using EasyFinance.Application.Features.SupportService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public class SupportController : BaseController
    {
        private readonly IContactService contactUsService;
        private readonly UserManager<User> userManager;

        public SupportController(UserManager<User> userManager,
            IContactService contactUsService)
        {
            this.userManager = userManager;
            this.contactUsService = contactUsService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateMessage([FromBody] ContactUsRequestDTO contactUsDto)
        {
            if (contactUsDto == null) return BadRequest();
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);
            var createdMessage = await contactUsService.CreateAsync(user, contactUsDto.FromDTO());

            return ValidateResponse(actionName: nameof(GetMessageById), routeValues: createdMessage?.Data?.Id, appResponse: createdMessage);
        }

        [HttpGet]
        public IActionResult GetMessageById(Guid messageId)
        {
            var message = contactUsService.GetById(messageId);

            if (message == null) return NotFound();

            return ValidateResponse(message, HttpStatusCode.OK);
        }
    }
}
