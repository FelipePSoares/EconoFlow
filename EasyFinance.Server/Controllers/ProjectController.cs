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
        private readonly ProjectService _projectService;
        private readonly UserManager<User> userManager;

        public ProjectController(ProjectService projectService, UserManager<User> userManager)
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

        [HttpGet("{id}")]
        public IActionResult GetProjectById(Guid id)
        {
            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);

            var project = _projectService.GetById(userId, id);

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

            return CreatedAtAction(nameof(GetProjectById), new { id = createdProject.Id }, createdProject);
        }

        [HttpPatch("{id}")]
        public async Task<IActionResult> UpdateProject(Guid id, [FromBody] JsonPatchDocument<ProjectRequestDTO> projectDto)
        {
            if (projectDto == null) return BadRequest();

            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);

            var existingProject = _projectService.GetById(userId, id);

            if (existingProject == null) return NotFound();

            var dto = existingProject.ToRequestDTO();

            projectDto.ApplyTo(dto);

            var project = dto.FromDTO();
            project.SetId(id);

            await _projectService.UpdateAsync(userId, project);

            return Ok();
        }

        [HttpDelete("{id}")]
        public IActionResult DeleteProject(Guid id)
        {
            var userId = new Guid(this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);

            var deletedProject = _projectService.DeleteAsync(userId, id);

            if (deletedProject == null) return NotFound();

            return NoContent();
        }
    }
}
