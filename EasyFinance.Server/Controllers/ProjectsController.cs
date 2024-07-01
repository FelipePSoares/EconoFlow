using System.Security.Claims;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Server.DTOs.FinancialProject;
using EasyFinance.Server.Mappers;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProjectsController : ControllerBase
    {
        private readonly IProjectService projectService;
        private readonly UserManager<User> userManager;

        public ProjectsController(IProjectService projectService, UserManager<User> userManager)
        {
            this.projectService = projectService;
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
    }
}
