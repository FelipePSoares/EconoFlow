using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Security.Claims;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/Categories/{categoryId}/[controller]")]
    public class ExpensesController : BaseController
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
            var expenses = await expenseService.GetAsync(categoryId: categoryId, from: from, to: to);
            return ValidateResponse(expenses, HttpStatusCode.OK);
        }

        [HttpGet("{expenseId}")]
        public async Task<IActionResult> GetById(Guid expenseId)
        {
            var expense = await expenseService.GetByIdAsync(expenseId);
            return ValidateResponse(expense, HttpStatusCode.OK);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid projectId, Guid categoryId, [FromBody] ExpenseRequestDTO expenseRequestDto)
        {
            if (expenseRequestDto == null) return BadRequest();

            var id = HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await userManager.FindByIdAsync(id.Value);

            var expenseResponseDto = await expenseService.CreateAsync(user: user, categoryId: categoryId, expense: expenseRequestDto.FromDTO());

            return ValidateResponse(actionName: nameof(GetById), routeValues: new { projectId, categoryId, expenseId = expenseResponseDto.Data.Id }, appResponse: expenseResponseDto);
        }

        [HttpPatch("{expenseId}")]
        public async Task<IActionResult> Update(Guid categoryId, Guid expenseId, [FromBody] JsonPatchDocument<ExpenseRequestDTO> expenseDto)
        {
            if (expenseDto == null) return BadRequest();

            var id = HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await userManager.FindByIdAsync(id.Value);

            var result = await expenseService.UpdateAsync(user: user, categoryId: categoryId, expenseId: expenseId, expenseDto: expenseDto);
            return ValidateResponse(result, HttpStatusCode.OK);
        }

        [HttpDelete("{expenseId}")]
        public async Task<IActionResult> DeleteAsync(Guid expenseId)
        {
            var result = await expenseService.DeleteAsync(expenseId);
            return ValidateResponse(result, HttpStatusCode.OK);
        }
    }
}
