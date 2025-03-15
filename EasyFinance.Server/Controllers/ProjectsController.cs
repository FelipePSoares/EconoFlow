using System.Net;
using System.Security.Claims;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Features.AccessControlService;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProjectsController : BaseController
    {
        private readonly IProjectService projectService;
        private readonly ICategoryService categoryService;
        private readonly IIncomeService incomeService;
        private readonly IAccessControlService accessControlService;
        private readonly UserManager<User> userManager;

        public ProjectsController(
            IProjectService projectService,
            ICategoryService categoryService,
            IIncomeService incomeService,
            IAccessControlService accessControlService,
            UserManager<User> userManager)
        {
            this.projectService = projectService;
            this.categoryService = categoryService;
            this.incomeService = incomeService;
            this.accessControlService = accessControlService;
            this.userManager = userManager;
        }

        [HttpGet]
        public IActionResult GetProjects()
        {
            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);

            var projects = projectService.GetAll(userId);
            return ValidateResponse(projects, HttpStatusCode.OK);
        }

        [HttpGet("{projectId}")]
        public async Task<IActionResult> GetProjectByIdAsync(Guid projectId)
        {
            var project = await projectService.GetByIdAsync(projectId);
            if (project == null) return NotFound();

            return ValidateResponse(project, HttpStatusCode.OK);
        }

        [HttpGet("{projectId}/year-summary/{year}")]
        public async Task<IActionResult> Get(Guid projectId, int year)
        {
            var incomes = await this.incomeService.GetAsync(projectId, year);
            var categories = await this.categoryService.GetAsync(projectId, year);

            var lastMonthData = categories.Data.Where(c => c.Expenses.Sum(e => e.Budget) != 0).Select(c => c.Expenses.Where(e => e.Budget != 0)?.Max(e => e.Date.Month)).Max();
            var totalBudgetLastMonthData = categories.Data.Sum(c => c.Expenses.Where(e => e.Date.Month == lastMonthData).Sum(e => e.Budget));

            var totalBudget = categories.Data.Sum(c => c.Expenses.Sum(e => e.Budget)) + (totalBudgetLastMonthData * (12 - lastMonthData ?? 0));
            var totalSpend = categories.Data.Sum(c => c.Expenses.Sum(e => e.Amount));
            var totalOverspend = categories.Data.Sum(c => c.Expenses.Sum(e =>
            {
                var overspend = e.Budget - e.Amount;
                return (overspend < 0) ? overspend * -1 : 0;
            }));

            return Ok(new
            {
                TotalBudget = totalBudget,
                TotalSpend = totalSpend - totalOverspend,
                TotalOverspend = totalOverspend,
                TotalRemaining = totalBudget - totalSpend,
                TotalEarned = incomes.Data.Sum(i => i.Amount),
            });
        }

        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] ProjectRequestDTO projectDto)
        {
            if (projectDto == null) return BadRequest();

            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            var createdProject = await projectService.CreateAsync(user, projectDto.FromDTO());

            return ValidateResponse(actionName: nameof(GetProjectByIdAsync), routeValues: new { projectId = createdProject.Data.Id }, appResponse: createdProject);
        }

        [HttpPatch("{projectId}")]
        public async Task<IActionResult> UpdateProject(Guid projectId, [FromBody] JsonPatchDocument<ProjectRequestDTO> projectDto)
        {
            if (projectDto == null) return BadRequest();

            var updateResult = await projectService.UpdateAsync(projectId: projectId, projectDto: projectDto);

            return ValidateResponse(updateResult, HttpStatusCode.OK);
        }

        [HttpDelete("{projectId}")]
        public async Task<IActionResult> DeleteProjectAsync(Guid projectId)
        {
            var deleteResult = await projectService.DeleteAsync(projectId);

            return ValidateResponse(deleteResult, HttpStatusCode.NoContent);
        }

        [HttpPost("{projectId}/copy-budget-previous-month")]
        public async Task<IActionResult> CopyFrom(Guid projectId, [FromBody] DateTime currentDate)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            var newExpenses = await projectService.CopyBudgetFromPreviousMonthAsync(user, projectId, currentDate);

            return ValidateResponse(newExpenses, HttpStatusCode.OK);
        }

        [HttpGet("{projectId}/latests/{numberOfTransactions}")]
        public async Task<IActionResult> GetLatestTransactions(Guid projectId, int numberOfTransactions)
        {
            var response = await projectService.GetLatestAsync(projectId, numberOfTransactions);

            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpPatch("{projectId}/access")]
        public async Task<IActionResult> UpdateAccessAsync(Guid projectId, [FromBody] JsonPatchDocument<IList<UserProjectRequestDTO>> userProjectDto)
        {
            if (userProjectDto == null) return BadRequest();

            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            var hasAuthorization = accessControlService.HasAuthorization(user.Id, projectId, Role.Admin);

            if (!hasAuthorization)
                return ValidateResponse(AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(ValidationMessages.Forbidden, ValidationMessages.Forbidden), HttpStatusCode.OK);

            var updateResult = await accessControlService.UpdateAccessAsync(user, projectId, userProjectDto);

            if (updateResult.Succeeded)
                updateResult = AppResponse<IEnumerable<UserProjectResponseDTO>>.Success(updateResult.Data.Where(data => data.UserId != user.Id));

            return ValidateResponse(updateResult, HttpStatusCode.OK);
        }

        [HttpPost("{token}/accept")]
        public async Task<IActionResult> AcceptInvitationAsync(Guid token)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            var response = await accessControlService.AcceptInvitationAsync(user, token);

            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpGet("{projectId}/users")]
        public async Task<IActionResult> GetProjectUsersAsync(Guid projectId)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            var response = await accessControlService.GetUsers(user, projectId);

            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpDelete("{projectId}/access/{userProjectId}")]
        public async Task<IActionResult> DeleteUserProjectAsync(Guid projectId, Guid userProjectId)
        {
            var user = await this.userManager.GetUserAsync(this.HttpContext.User);

            var hasAuthorization = accessControlService.HasAuthorization(user.Id, projectId, Role.Admin);

            if (!hasAuthorization)
                return ValidateResponse(AppResponse<IEnumerable<UserProjectResponseDTO>>.Error(ValidationMessages.Forbidden, ValidationMessages.Forbidden), HttpStatusCode.OK);

            AppResponse result = await this.accessControlService.RemoveAccessAsync(userProjectId);

            return ValidateResponse(result, HttpStatusCode.OK);
        }
    }
}
