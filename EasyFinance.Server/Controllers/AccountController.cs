using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Server.DTOs.AccessControl;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.RegularExpressions;


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
        private readonly IExpenseService expenseService;
        private readonly IExpenseItemService expenseItemService;
        private readonly IIncomeService incomeService;
        private readonly IProjectService projectService;

        public AccountController(
            UserManager<User> userManager,
            SignInManager<User> signInManager,
            IEmailSender emailSender,
            IExpenseService expenseService,
            IExpenseItemService expenseItemService,
            IIncomeService incomeService,
            IProjectService projectService
            )
        {
            this.userManager = userManager;
            this.signInManager = signInManager;
            this.emailSender = emailSender;
            this.expenseService = expenseService;
            this.expenseItemService = expenseItemService;
            this.incomeService = incomeService;
            this.projectService = projectService;
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
        public async Task<IActionResult> UpdateUserAsync([FromBody] UserRequestDTO userDTO)
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            if (user == null)
                BadRequest("User not found!");

            user.SetFirstName(userDTO.FirstName);
            user.SetLastName(userDTO.LastName);

            if (!string.IsNullOrEmpty(userDTO.PreferredCurrency))
                user.SetPreferredCurrency(userDTO.PreferredCurrency);

            if (!string.IsNullOrEmpty(userDTO.TimeZoneId))
                user.SetTimezone(userDTO.TimeZoneId);

            await this.userManager.UpdateAsync(user);
            await this.signInManager.RefreshSignInAsync(user);

            return Ok(new UserResponseDTO(user));
        }

        [HttpDelete]
        public async Task<IActionResult> DeleteUserAsync()
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            if (user == null)
                BadRequest("User not found!");

            await this.projectService.DeleteOrRemoveLinkAsync(user);

            var tasks = new List<Task>
            {
                this.expenseService.RemoveLinkAsync(user),
                this.expenseItemService.RemoveLinkAsync(user),
                this.incomeService.RemoveLinkAsync(user)
            };
            await Task.WhenAll(tasks);

            await this.userManager.DeleteAsync(user);

            return Ok();
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

        [HttpGet("search")]
        public IActionResult SearchUsers([FromQuery] string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return Ok(new List<UserSearchResponseDTO>());
            }

            searchTerm = Regex.Escape(searchTerm).ToLower();

            var users = userManager.Users.Where(u =>
                    u.FirstName.ToLower().Contains(searchTerm) ||
                    u.LastName.ToLower().Contains(searchTerm) ||
                    u.Email.ToLower().Contains(searchTerm))
                .Take(50)
                .Select(u => new UserSearchResponseDTO(u))
                .ToList();

            return Ok(users);
        }
    }
}
