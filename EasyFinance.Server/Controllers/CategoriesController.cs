using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Server.DTOs.Financial;
using EasyFinance.Server.Mappers;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/[controller]")]
    public class CategoriesController : Controller
    {
        private readonly ICategoryService categoryService;

        public CategoriesController(ICategoryService categoryService)
        {
            this.categoryService = categoryService;
        }

        [HttpGet]
        public async Task<IActionResult> Get(Guid projectId, DateTime from, DateTime to)
        {
            var categories = await this.categoryService.GetAsync(projectId, from, to);
            return Ok(categories.ToDTO());
        }

        [HttpGet("DefaultCategories")]
        public async Task<IActionResult> GetDefaultCategories(Guid projectId)
        {
            var categories = await categoryService.GetDefaultCategoriesAsync(projectId);
            return Ok(categories);
        }

        [HttpGet("{categoryId}")]
        public async Task<IActionResult> GetById(Guid categoryId)
        {
            var category = await this.categoryService.GetByIdAsync(categoryId);
            return Ok(category.ToDTO());
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid projectId, [FromBody] CategoryRequestDTO categoryDTO)
        {
            if (categoryDTO == null) return BadRequest();

            var createdCategory = (await categoryService.CreateAsync(projectId, categoryDTO.FromDTO())).ToDTO();

            return CreatedAtAction(nameof(GetById), new { projectId, categoryId = createdCategory.Id }, createdCategory);
        }

        [HttpPatch("{categoryId}")]
        public async Task<IActionResult> Update(Guid projectId, Guid categoryId, [FromBody] JsonPatchDocument<CategoryRequestDTO> categoryDto)
        {
            if (categoryDto == null) return BadRequest();

            var existingCategory = await categoryService.GetByIdAsync(categoryId);

            if (existingCategory == null) return NotFound();

            var dto = existingCategory.ToRequestDTO();
            categoryDto.ApplyTo(dto);

            dto.FromDTO(existingCategory);

            await categoryService.UpdateAsync(existingCategory);

            return Ok(existingCategory);
        }

        [HttpDelete("{categoryId}")]
        public async Task<IActionResult> Delete(Guid categoryId)
        {
            await categoryService.DeleteAsync(categoryId);

            return NoContent();
        }
    }
}
