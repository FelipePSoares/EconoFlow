using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Features.TaxYearService;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/projects/{projectId}")]
    public class ProjectTaxYearsController : BaseController
    {
        private readonly ITaxYearService taxYearService;

        public ProjectTaxYearsController(ITaxYearService taxYearService)
        {
            this.taxYearService = taxYearService;
        }

        [HttpPut("settings/tax-year")]
        public async Task<IActionResult> PutTaxYearSettingsAsync(Guid projectId, [FromBody] ProjectTaxYearSettingsRequestDTO requestDto)
        {
            if (requestDto == null)
                return BadRequest();

            var response = await this.taxYearService.UpsertTaxYearSettingsAsync(projectId, requestDto);
            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpGet("settings/tax-year")]
        public async Task<IActionResult> GetTaxYearSettingsAsync(Guid projectId)
        {
            var response = await this.taxYearService.GetTaxYearSettingsAsync(projectId);
            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpGet("tax-years")]
        public async Task<IActionResult> GetTaxYearsAsync(Guid projectId)
        {
            var response = await this.taxYearService.GetTaxYearsAsync(projectId);
            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpGet("tax-years/{taxYearId}/deductible-groups")]
        public async Task<IActionResult> GetDeductibleGroupsAsync(Guid projectId, string taxYearId)
        {
            var response = await this.taxYearService.GetDeductibleGroupsAsync(projectId, taxYearId);
            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpPost("tax-years/{taxYearId}/deductible-groups")]
        public async Task<IActionResult> CreateDeductibleGroupAsync(Guid projectId, string taxYearId, [FromBody] DeductibleGroupRequestDTO requestDto)
        {
            if (requestDto == null)
                return BadRequest();

            var response = await this.taxYearService.CreateDeductibleGroupAsync(projectId, taxYearId, requestDto);
            return ValidateResponse(response, HttpStatusCode.Created);
        }

        [HttpPut("tax-years/{taxYearId}/deductible-groups/{groupId}")]
        public async Task<IActionResult> UpdateDeductibleGroupAsync(Guid projectId, string taxYearId, Guid groupId, [FromBody] DeductibleGroupRequestDTO requestDto)
        {
            if (requestDto == null)
                return BadRequest();

            var response = await this.taxYearService.UpdateDeductibleGroupAsync(projectId, taxYearId, groupId, requestDto);
            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpDelete("tax-years/{taxYearId}/deductible-groups/{groupId}")]
        public async Task<IActionResult> DeleteDeductibleGroupAsync(Guid projectId, string taxYearId, Guid groupId)
        {
            var response = await this.taxYearService.DeleteDeductibleGroupAsync(projectId, taxYearId, groupId);
            return ValidateResponse(response, HttpStatusCode.NoContent);
        }

        [HttpGet("tax-years/{taxYearId}/deductible-groups/{groupId}/expenses")]
        public async Task<IActionResult> GetGroupExpensesAsync(Guid projectId, string taxYearId, Guid groupId)
        {
            var response = await this.taxYearService.GetGroupExpensesAsync(projectId, taxYearId, groupId);
            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpPost("tax-years/{taxYearId}/deductible-groups/{groupId}/expenses")]
        public async Task<IActionResult> AssignExpenseAsync(Guid projectId, string taxYearId, Guid groupId, [FromBody] DeductibleGroupExpenseRequestDTO requestDto)
        {
            if (requestDto == null)
                return BadRequest();

            var response = await this.taxYearService.AssignExpenseToGroupAsync(projectId, taxYearId, groupId, requestDto.ExpenseId);
            return ValidateResponse(response, HttpStatusCode.Created);
        }

        [HttpDelete("tax-years/{taxYearId}/deductible-groups/{groupId}/expenses/{expenseId}")]
        public async Task<IActionResult> RemoveExpenseAsync(Guid projectId, string taxYearId, Guid groupId, Guid expenseId)
        {
            var response = await this.taxYearService.RemoveExpenseFromGroupAsync(projectId, taxYearId, groupId, expenseId);
            return ValidateResponse(response, HttpStatusCode.NoContent);
        }

        [HttpGet("tax-years/{taxYearId}/deductible-groups/totals")]
        public async Task<IActionResult> GetTotalsAsync(Guid projectId, string taxYearId)
        {
            var response = await this.taxYearService.GetTotalsAsync(projectId, taxYearId);
            return ValidateResponse(response, HttpStatusCode.OK);
        }
    }
}
