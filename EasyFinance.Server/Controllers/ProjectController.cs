using System.Security.Claims;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Server.DTOs;
using EasyFinance.Server.Mappers;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProjectController : ControllerBase
    {
        private readonly IProjectService _projectService;
        private readonly UserManager<User> userManager;

        public ProjectController(IProjectService projectService, UserManager<User> userManager)
        {
            _projectService = projectService;
            this.userManager = userManager;
        }

        [HttpGet]
        public IActionResult GetProjects()
        {
            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);

            var projects = _projectService.GetAll(userId);
            return Ok(projects.ToDTO());
        }

        [HttpGet("{projectId}")]
        public IActionResult GetProjectById(Guid projectId)
        {
            var project = _projectService.GetById(projectId);

            if (project == null) return NotFound();

            return Ok(project.ToDTO());
        }

        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] ProjectRequestDTO projectDto)
        {
            if (projectDto == null) return BadRequest();

            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            var createdProject = (await _projectService.CreateAsync(user, projectDto.FromDTO())).ToDTO();

            return CreatedAtAction(nameof(GetProjectById), new { projectId = createdProject.Id }, createdProject);
        }

        [HttpPatch("{projectId}")]
        public async Task<IActionResult> UpdateProject(Guid projectId, [FromBody] JsonPatchDocument<ProjectRequestDTO> projectDto)
        {
            if (projectDto == null) return BadRequest();

            var existingProject = _projectService.GetById(projectId);

            if (existingProject == null) return NotFound();

            var dto = existingProject.ToRequestDTO();

            projectDto.ApplyTo(dto);

            var project = dto.FromDTO();
            project.SetId(projectId);

            await _projectService.UpdateAsync(project);

            return Ok(project);
        }

        [HttpDelete("{projectId}")]
        public async Task<IActionResult> DeleteProjectAsync(Guid projectId)
        {
            await _projectService.DeleteAsync(projectId);

            return NoContent();
        }
    }
}
