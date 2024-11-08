using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Server.DTOs.Financial;
using EasyFinance.Server.Mappers;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/Categories/{categoryId}/[controller]")]
    public class ExpensesController : Controller
    {
        private readonly IExpenseService expenseService;
        private readonly UserManager<User> userManager;

        public ExpensesController(IExpenseService expenseService, UserManager<User> userManager)
        {
            this.expenseService = expenseService;
            this.userManager = userManager;
        }


        [HttpGet]
        public async Task<IActionResult> Get(Guid categoryId, DateTime from, DateTime to)
        {
            var expenses = await this.expenseService.GetAsync(categoryId, from, to);
            return Ok(expenses.ToDTO());
        }

        [HttpGet("{expenseId}")]
        public async Task<IActionResult> GetById(Guid expenseId)
        {
            var expense = await this.expenseService.GetByIdAsync(expenseId);

            if (expense == null) return NotFound();

            return Ok(expense.ToDTO());
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid projectId, Guid categoryId, [FromBody] ExpenseRequestDTO expenseDto)
        {
            if (expenseDto == null) return BadRequest();

            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            var createdExpense = (await this.expenseService.CreateAsync(user, categoryId, expenseDto.FromDTO())).ToDTO();

            return CreatedAtAction(nameof(GetById), new {projectId, categoryId, expenseId = createdExpense.Id }, createdExpense);
        }

        [HttpPatch("{expenseId}")]
        public async Task<IActionResult> Update(Guid categoryId, Guid expenseId, [FromBody] JsonPatchDocument<ExpenseRequestDTO> expenseDto)
        {
            if (expenseDto == null) return BadRequest();

            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            var existingExpense = await this.expenseService.GetByIdAsync(expenseId);

            if (existingExpense == null) return NotFound();

            var dto = existingExpense.ToRequestDTO();

            expenseDto.ApplyTo(dto);

            dto.FromDTO(existingExpense);

            foreach (var expense in existingExpense.Items.Where(item => item.Id == default))
            {
                expense.SetCreatedBy(user);
            }

            await this.expenseService.UpdateAsync(existingExpense);

            return Ok(existingExpense);
        }

        [HttpDelete("{expenseId}")]
        public async Task<IActionResult> DeleteAsync(Guid expenseId)
        {
            await this.expenseService.DeleteAsync(expenseId);

            return NoContent();
        }
    }
}
