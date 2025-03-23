using System.Net;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Application.Mappers;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/[controller]")]
    public class CategoriesController : BaseController
    {
        private readonly ICategoryService categoryService;

        public CategoriesController(ICategoryService categoryService)
        {
            this.categoryService = categoryService;
        }

        [HttpGet]
        public async Task<IActionResult> Get(Guid projectId, DateOnly? from, DateOnly? to)
        {
            var categories = await categoryService.GetAsync(projectId, from, to);
            return ValidateResponse(categories, HttpStatusCode.OK);
        }

        [HttpGet("DefaultCategories")]
        public async Task<IActionResult> GetDefaultCategories(Guid projectId)
        {
            var categories = await categoryService.GetDefaultCategoriesAsync(projectId);
            return ValidateResponse(categories, HttpStatusCode.OK);
        }

        [HttpGet("{categoryId}")]
        public async Task<IActionResult> GetById(Guid categoryId)
        {
            var category = await categoryService.GetByIdAsync(categoryId);
            return ValidateResponse(category, HttpStatusCode.OK);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid projectId, [FromBody] CategoryRequestDTO categoryDTO)
        {
            if (categoryDTO == null) return BadRequest();
            var createdCategory = await categoryService.CreateAsync(projectId, categoryDTO.FromDTO());

            return ValidateResponse(actionName: nameof(GetById), routeValues: new { projectId, categoryId = createdCategory.Data.Id }, appResponse: createdCategory);
        }        

        [HttpPatch("{categoryId}")]
        public async Task<IActionResult> Update(Guid projectId, Guid categoryId, [FromBody] JsonPatchDocument<CategoryRequestDTO> categoryDto)
        {
            if (categoryDto == null) return BadRequest();
            var updateResult = await categoryService.UpdateAsync(categoryId: categoryId, categoryDto: categoryDto);

            return ValidateResponse(updateResult, HttpStatusCode.OK);
        }

        [HttpDelete("{categoryId}")]
        public async Task<IActionResult> Delete(Guid categoryId)
        {
            var deleteResult = await categoryService.DeleteAsync(categoryId);

            return ValidateResponse(deleteResult, HttpStatusCode.NoContent);
        }
    }
}
