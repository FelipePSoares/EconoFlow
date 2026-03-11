using System.Net;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Features.PlanService;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/[controller]")]
    public class PlansController : BaseController
    {
        private readonly IPlanService planService;

        public PlansController(IPlanService planService)
        {
            this.planService = planService;
        }

        [HttpGet]
        public async Task<IActionResult> GetPlansAsync(Guid projectId)
        {
            var response = await this.planService.GetPlansAsync(projectId);
            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpPost]
        public async Task<IActionResult> CreatePlanAsync(Guid projectId, [FromBody] PlanRequestDTO requestDto)
        {
            if (requestDto == null)
                return BadRequest();

            var response = await this.planService.CreatePlanAsync(projectId, requestDto);
            return ValidateResponse(response, HttpStatusCode.Created);
        }

        [HttpPatch("{planId}")]
        public async Task<IActionResult> UpdatePlanAsync(Guid projectId, Guid planId, [FromBody] JsonPatchDocument<PlanRequestDTO> requestDto)
        {
            if (requestDto == null)
                return BadRequest();

            var response = await this.planService.UpdatePlanAsync(projectId, planId, requestDto);
            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpPut("{planId}/archive")]
        public async Task<IActionResult> ArchivePlanAsync(Guid projectId, Guid planId)
        {
            var response = await this.planService.ArchivePlanAsync(projectId, planId);
            return ValidateResponse(response, HttpStatusCode.NoContent);
        }

        [HttpGet("{planId}/entries")]
        public async Task<IActionResult> GetPlanEntriesAsync(Guid projectId, Guid planId)
        {
            var response = await this.planService.GetEntriesAsync(projectId, planId);
            return ValidateResponse(response, HttpStatusCode.OK);
        }

        [HttpPost("{planId}/entries")]
        public async Task<IActionResult> AddPlanEntryAsync(Guid projectId, Guid planId, [FromBody] PlanEntryRequestDTO requestDto)
        {
            if (requestDto == null)
                return BadRequest();

            var response = await this.planService.AddEntryAsync(projectId, planId, requestDto);
            return ValidateResponse(response, HttpStatusCode.Created);
        }
    }
}
