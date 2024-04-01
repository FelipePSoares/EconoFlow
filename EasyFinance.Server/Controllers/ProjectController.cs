using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Server.DTOs;
using EasyFinance.Server.Mappers;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProjectController : ControllerBase
    {
        private readonly ProjectService _projectService;

        public ProjectController(ProjectService projectService)
        {
            _projectService = projectService;
        }

        [HttpGet]
        public IActionResult GetProjects()
        {
            var projects = _projectService.GetAllAsync();
            return Ok(projects.ToDTO());
        }

        [HttpGet("{id}")]
        public IActionResult GetProjectById(Guid id)
        {
            var project = _projectService.GetById(id);

            if (project == null) return NotFound();

            return Ok(project.ToDTO());
        }

        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] ProjectRequestDTO projectDto)
        {
            if (projectDto == null) return BadRequest();

            var createdProject = (await _projectService.CreateAsync(projectDto.FromDTO())).ToDTO();

            return CreatedAtAction(nameof(GetProjectById), new { id = createdProject.Id }, createdProject);
        }

        [HttpPatch("{id}")]
        public async Task<IActionResult> UpdateProject(Guid id, [FromBody] JsonPatchDocument<ProjectRequestDTO> projectDto)
        {
            if (projectDto == null) return BadRequest();
            
            var existingProject = _projectService.GetById(id);

            if (existingProject == null) return NotFound();
            
            var dto = existingProject.ToRequestDTO();

            projectDto.ApplyTo(dto);

            var project = dto.FromDTO();

            project.SetId(id);

            await _projectService.UpdateAsync(project);

            return Ok();
        }

        [HttpDelete("{id}")]
        public IActionResult DeleteProject(Guid id)
        {
            var deletedProject = _projectService.DeleteAsync(id);

            if (deletedProject == null) return NotFound();

            return NoContent();
        }
    }
}
