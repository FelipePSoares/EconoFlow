using AutoMapper;
using EasyFinance.Application.DTOs;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Server.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.JsonPatch.Exceptions;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous]
    public class ProjectController : ControllerBase
    {
        private readonly ProjectService _projectService;
        private IMapper _mapper;

        public ProjectController(ProjectService projectService, IMapper mapper)
        {
            _projectService = projectService;
            _mapper = mapper;
        }

        [HttpGet]
        public IActionResult GetProjects()
        {
            var projects = _projectService.GetAllAsync();
            return Ok(projects);
        }

        [HttpGet("{id}")]
        public IActionResult GetProjectById(Guid id)
        {
            var project = _projectService.GetById(id);

            if (project == null) return NotFound();

            return Ok(project);
        }

        [HttpPost]
        public IActionResult CreateProject([FromBody] ProjectDto projectDto)
        {
            if (projectDto == null) return BadRequest();

            var createdProject = _projectService.CreateAsync(_mapper.Map<ProjectDtoApp>(projectDto));

            return CreatedAtAction(nameof(GetProjectById), new { id = createdProject.Id }, createdProject);
        }

        [HttpPatch("{id}")]
        public IActionResult UpdateProject(Guid id, [FromBody] JsonPatchDocument<ProjectDto> projectDto)
        {
            if (projectDto == null) return BadRequest();
            
            var existingProject = _projectService.GetById(id);

            if (existingProject == null) return NotFound();
            
            var dto = _mapper.Map<ProjectDto>(existingProject);

            projectDto.ApplyTo(dto);

            var updatedProject = _projectService.UpdateAsync(_mapper.Map<ProjectDtoApp>(dto));

            return Ok(updatedProject);
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
