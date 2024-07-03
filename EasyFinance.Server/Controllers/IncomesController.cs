using System.Security.Claims;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Server.DTOs.Financial;
using EasyFinance.Server.Mappers;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/[controller]")]
    public class IncomesController : Controller
    {
        private readonly IIncomeService incomeService;
        private readonly UserManager<User> userManager;

        public IncomesController(IIncomeService incomeService, UserManager<User> userManager)
        {
            this.incomeService = incomeService;
            this.userManager = userManager;
        }

        [HttpGet]
        public IActionResult GetIncomes(Guid projectId)
        {
            var incomes = incomeService.GetAll(projectId);
            return Ok(incomes.ToDTO());
        }

        [HttpGet("{incomeId}")]
        public IActionResult GetIncomeById(Guid incomeId) 
        {
            var income = incomeService.GetById(incomeId);

            if (income == null) return NotFound();

            return Ok(income.ToDTO());
        }

        [HttpPost]
        public async Task<IActionResult> CreateIncome(Guid projectId, [FromBody] IncomeRequestDTO incomeDto)
        {
            if (incomeDto == null) return BadRequest();

            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            var createdIncome = (await incomeService.CreateAsync(user, projectId, incomeDto.FromDTO())).ToDTO();

            return CreatedAtAction(nameof(GetIncomeById), new { projectId, incomeId = createdIncome.Id }, createdIncome);
        }

        [HttpPatch("{incomeId}")]
        public async Task<IActionResult> UpdateIncome(Guid projectId, Guid incomeId, [FromBody] JsonPatchDocument<IncomeRequestDTO> incomeDto)
        {
            if (incomeDto == null) return BadRequest();

            var existingIncome = incomeService.GetById(incomeId);

            if (existingIncome == null) return NotFound();

            var dto = existingIncome.ToRequestDTO();

            incomeDto.ApplyTo(dto);

            var income = dto.FromDTO(existingIncome);

            await incomeService.UpdateAsync(existingIncome);

            return Ok(existingIncome);
        }

        [HttpDelete("{incomeId}")]
        public async Task<IActionResult> DeleteIncomeAsync(Guid incomeId)
        {
            await incomeService.DeleteAsync(incomeId);

            return NoContent();
        }
    }
}
