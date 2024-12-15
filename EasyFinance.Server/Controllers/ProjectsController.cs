using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProjectsController : ControllerBase
    {
        private readonly IProjectService projectService;
        private readonly ICategoryService categoryService;
        private readonly IIncomeService incomeService;
        private readonly UserManager<User> userManager;

        public ProjectsController(IProjectService projectService, ICategoryService categoryService, IIncomeService incomeService, UserManager<User> userManager)
        {
            this.projectService = projectService;
            this.categoryService = categoryService;
            this.incomeService = incomeService;
            this.userManager = userManager;
        }

        [HttpGet]
        public IActionResult GetProjects()
        {
            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);

            var projects = projectService.GetAll(userId);
            return Ok(projects.ToDTO());
        }

        [HttpGet("{projectId}")]
        public IActionResult GetProjectById(Guid projectId)
        {
            var project = projectService.GetById(projectId);

            if (project == null) return NotFound();

            return Ok(project.ToDTO());
        }

        [HttpGet("{projectId}/year-summary/{year}")]
        public async Task<IActionResult> Get(Guid projectId, int year)
        {
            var incomes = await this.incomeService.GetAsync(projectId, year);
            var categories = await this.categoryService.GetAsync(projectId, year);

            var lastMonthData = categories.Data.Where(c => c.Expenses.Sum(e => e.Budget) != 0).Select(c => c.Expenses.Where(e => e.Budget != 0)?.Max(e => e.Date.Month)).Max();
            var totalBudgetLastMonthData = categories.Data.Sum(c => c.Expenses.Where(e => e.Date.Month == lastMonthData).Sum(e => e.Budget));

            var totalBudget = categories.Data.Sum(c => c.Expenses.Sum(e => e.Budget)) + (totalBudgetLastMonthData * (12 - lastMonthData ?? 0));
            var totalWaste = categories.Data.Sum(c => c.Expenses.Sum(e => e.Amount));

            return Ok(new
            {
                TotalBudget = totalBudget,
                TotalWaste = totalWaste,
                TotalRemaining = totalBudget - totalWaste,
                TotalEarned = incomes.Data.Sum(i => i.Amount),
            });
        }

        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] ProjectRequestDTO projectDto)
        {
            if (projectDto == null) return BadRequest();

            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            var createdProject = (await projectService.CreateAsync(user, projectDto.FromDTO())).ToDTO();

            return CreatedAtAction(nameof(GetProjectById), new { projectId = createdProject.Id }, createdProject);
        }

        [HttpPatch("{projectId}")]
        public async Task<IActionResult> UpdateProject(Guid projectId, [FromBody] JsonPatchDocument<ProjectRequestDTO> projectDto)
        {
            if (projectDto == null) return BadRequest();

            var existingProject = projectService.GetById(projectId);

            if (existingProject == null) return NotFound();

            var dto = existingProject.ToRequestDTO();

            projectDto.ApplyTo(dto);

            dto.FromDTO(existingProject);

            await projectService.UpdateAsync(existingProject);

            return Ok(existingProject);
        }

        [HttpDelete("{projectId}")]
        public async Task<IActionResult> DeleteProjectAsync(Guid projectId)
        {
            await projectService.DeleteAsync(projectId);

            return NoContent();
        }

        [HttpPost("{projectId}/copy-budget-previous-month")]
        public async Task<IActionResult> CopyFrom(Guid projectId, [FromBody] DateTime currentDate)
        {
            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            var newExpenses = await projectService.CopyBudgetFromPreviousMonthAsync(user, projectId, currentDate);

            return Ok(newExpenses.ToDTO());
        }
    }
}
