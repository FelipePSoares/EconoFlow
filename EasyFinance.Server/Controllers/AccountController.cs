using System.Security.Claims;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Server.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Tags("AccessControl")]
    [Route("api/[controller]")]
    public class AccountController : Controller
    {
        private readonly UserManager<User> userManager;
        private readonly SignInManager<User> signInManager;

        public AccountController(UserManager<User> userManager, SignInManager<User> signInManager)
        {
            this.userManager = userManager;
            this.signInManager = signInManager;
        }
        
        [HttpGet]
        public async Task<IActionResult> GetUserAsync()
        {
            var email = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.Email);
            var user = await this.userManager.FindByEmailAsync(email.Value);

            if (user == null)
                BadRequest("User not found!");

            return Ok(new UserResponseDTO(user));
        }

        [HttpPut]
        public async Task<IActionResult> SetUserNameAsync([FromBody]UserRequestDTO userDTO)
        {
            var email = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.Email);
            var user = await this.userManager.FindByEmailAsync(email.Value);

            if (user == null)
                BadRequest("User not found!");

            user.SetFirstName(userDTO.FirstName);
            user.SetLastName(userDTO.LastName);
            user.IsFirstLogin = false;

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
            var email = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.Email);
            var user = await this.userManager.FindByEmailAsync(email.Value);

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
            var email = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.Email);
            var user = await this.userManager.FindByEmailAsync(email.Value);

            if (user == null)
                BadRequest("User not found!");

            user.Enabled = true;

            await this.userManager.UpdateAsync(user);

            return Ok();
        }
    }
}
