using System.Security.Claims;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Application.DTOs.Financial;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/[controller]")]
    public class IncomesController : BaseController
    {
        private readonly IIncomeService incomeService;
        private readonly UserManager<User> userManager;

        public IncomesController(IIncomeService incomeService, UserManager<User> userManager)
        {
            this.incomeService = incomeService;
            this.userManager = userManager;
        }

        [HttpGet]
        public IActionResult Get(Guid projectId, DateTime from, DateTime to)
        {
            var incomes = incomeService.Get(projectId, from, to);
            return ValidateResponse(incomes, HttpStatusCode.OK);
        }

        [HttpGet("{incomeId}")]
        public IActionResult GetById(Guid incomeId) 
        {
            var income = incomeService.GetById(incomeId);

            if (income == null) return NotFound();

            return ValidateResponse(income, HttpStatusCode.OK);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid projectId, [FromBody] IncomeRequestDTO incomeDto)
        {
            if (incomeDto == null) return BadRequest();

            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);
            var createdIncome = await incomeService.CreateAsync(user, projectId, incomeDto.FromDTO());

            return ValidateResponse(actionName: nameof(GetById), routeValues: new { projectId, incomeId = createdIncome.Data.Id }, createdIncome);
        }

       

        [HttpPatch("{incomeId}")]
        public async Task<IActionResult> Update(Guid projectId, Guid incomeId, [FromBody] JsonPatchDocument<IncomeRequestDTO> incomeDto)
        {
            if (incomeDto == null) return BadRequest();

            var updateResult = await incomeService.UpdateAsync(incomeId: incomeId, incomeDto: incomeDto);          

            return ValidateResponse(updateResult, HttpStatusCode.OK);
        }

        [HttpDelete("{incomeId}")]
        public async Task<IActionResult> DeleteAsync(Guid incomeId)
        {
            var deleteResult = await incomeService.DeleteAsync(incomeId);

            return ValidateResponse(deleteResult, HttpStatusCode.NoContent);
        }
    }
}
