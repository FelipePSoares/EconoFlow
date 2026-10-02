using System.Net;
using System.Security.Claims;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/[controller]")]
    public class IncomesController : BaseController
    {
        private readonly IIncomeService incomeService;
        private readonly IAttachmentService attachmentService;
        private readonly UserManager<User> userManager;

        public IncomesController(
            IIncomeService incomeService,
            IAttachmentService attachmentService,
            UserManager<User> userManager)
        {
            this.incomeService = incomeService;
            this.attachmentService = attachmentService;
            this.userManager = userManager;
        }

        [HttpGet]
        public IActionResult Get(Guid projectId, DateOnly from, DateOnly to)
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
            var createdIncome = await incomeService.CreateAsync(user, projectId, incomeDto);

            return ValidateResponse(actionName: nameof(GetById), routeValues: new { projectId, incomeId = createdIncome?.Data?.Id }, createdIncome);
        }



        [HttpPatch("{incomeId}")]
        public async Task<IActionResult> Update(Guid projectId, Guid incomeId, [FromBody] JsonPatchDocument<IncomeRequestDTO> incomeDto)
        {
            if (incomeDto == null) return BadRequest();

            var id = this.HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await this.userManager.FindByIdAsync(id.Value);

            var updateResult = await incomeService.UpdateAsync(
                user: user,
                projectId: projectId,
                incomeId: incomeId,
                incomeDto: incomeDto);

            return ValidateResponse(updateResult, HttpStatusCode.OK);
        }

        [HttpDelete("{incomeId}")]
        public async Task<IActionResult> DeleteAsync(Guid incomeId)
        {
            var deleteResult = await incomeService.DeleteAsync(incomeId);

            return ValidateResponse(deleteResult, HttpStatusCode.NoContent);
        }

        [HttpPut("{incomeId}/restore")]
        public async Task<IActionResult> RestoreAsync(Guid incomeId)
        {
            var result = await incomeService.RestoreAsync(incomeId);
            return ValidateResponse(result, HttpStatusCode.NoContent);
        }

        [HttpPost("temporary-attachments")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadTemporaryAttachmentAsync(Guid projectId, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest();

            var id = HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await userManager.FindByIdAsync(id.Value);

            await using var stream = file.OpenReadStream();
            var uploadResponse = await this.attachmentService.UploadTemporaryAttachmentAsync(
                user: user,
                projectId: projectId,
                content: stream,
                fileName: file.FileName,
                contentType: file.ContentType,
                size: file.Length,
                attachmentType: AttachmentType.General);

            return ValidateResponse(uploadResponse, HttpStatusCode.Created);
        }

        [HttpPost("{incomeId}/attachments")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadAttachmentAsync(Guid projectId, Guid incomeId, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest();

            var id = HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await userManager.FindByIdAsync(id.Value);

            await using var stream = file.OpenReadStream();
            var uploadResponse = await this.attachmentService.UploadIncomeAttachmentAsync(
                user: user,
                projectId: projectId,
                incomeId: incomeId,
                content: stream,
                fileName: file.FileName,
                contentType: file.ContentType,
                size: file.Length);

            return ValidateResponse(uploadResponse, HttpStatusCode.Created);
        }

        [HttpGet("{incomeId}/attachments/{attachmentId}")]
        public async Task<IActionResult> GetAttachmentAsync(Guid projectId, Guid incomeId, Guid attachmentId)
        {
            var fileResponse = await this.attachmentService.GetIncomeAttachmentAsync(projectId, incomeId, attachmentId);
            if (fileResponse.Failed)
                return ValidateResponse(fileResponse, HttpStatusCode.OK);

            return File(fileResponse.Data.Content, fileResponse.Data.ContentType, fileResponse.Data.Name);
        }

        [HttpDelete("{incomeId}/attachments/{attachmentId}")]
        public async Task<IActionResult> DeleteAttachmentAsync(Guid projectId, Guid incomeId, Guid attachmentId)
        {
            var deleteResponse = await this.attachmentService.DeleteIncomeAttachmentAsync(projectId, incomeId, attachmentId);
            return ValidateResponse(deleteResponse, HttpStatusCode.OK);
        }
    }
}
