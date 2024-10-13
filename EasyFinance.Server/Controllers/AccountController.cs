using System.Security.Claims;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Server.DTOs.AccessControl;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using SendGrid.Helpers.Mail;
using SendGrid;
using Microsoft.AspNetCore.Identity.UI.Services;
using EasyFinance.Server.Config;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Tags("AccessControl")]
    [Route("api/[controller]")]
    public class AccountController : Controller
    {
        private readonly UserManager<User> userManager;
        private readonly SignInManager<User> signInManager;
        private readonly IEmailSender emailSender;

        public AccountController(UserManager<User> userManager, SignInManager<User> signInManager, IEmailSender emailSender)
        {
            this.userManager = userManager;
            this.signInManager = signInManager;
            this.emailSender = emailSender;
        }
        
        [HttpGet]
        public async Task<IActionResult> GetUserAsync()
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            if (user == null)
                BadRequest("User not found!");

            return Ok(new UserResponseDTO(user));
        }

        [HttpPut]
        public async Task<IActionResult> SetUserNameAsync([FromBody]UserRequestDTO userDTO)
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            if (user == null)
                BadRequest("User not found!");

            user.SetFirstName(userDTO.FirstName);
            user.SetLastName(userDTO.LastName);

            await this.userManager.UpdateAsync(user);
            await this.signInManager.RefreshSignInAsync(user);

            return Ok(new UserResponseDTO(user));
        }

        [HttpPost("logout")]
        public async Task<IActionResult> SignOutAsync()
        {
            await this.signInManager.SignOutAsync();

            return Ok();
        }

        [HttpPut("deactivate")]
        public async Task<IActionResult> DeactivateUserAsync()
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

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
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            if (user == null)
                BadRequest("User not found!");

            user.Enabled = true;

            await this.userManager.UpdateAsync(user);

            return Ok();
        }

        [HttpPost("testEmail")]
        public async Task TestEmail()
        {
            var to = "felipepsoares@outlook.com.br";
            var subject = "Test Email";
            var htmlContent = "<strong>This is my test email</strong>";

            await emailSender.SendEmailAsync(to, subject, htmlContent);
        }


    }
}
