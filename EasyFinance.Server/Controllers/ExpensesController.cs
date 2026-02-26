using System.Net;
using System.Security.Claims;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/Categories/{categoryId}/[controller]")]
    public class ExpensesController : BaseController
    {
        private readonly IExpenseService expenseService;
        private readonly IAttachmentService attachmentService;
        private readonly UserManager<User> userManager;

        public ExpensesController(
            IExpenseService expenseService,
            IAttachmentService attachmentService,
            UserManager<User> userManager)
        {
            this.expenseService = expenseService;
            this.attachmentService = attachmentService;
            this.userManager = userManager;
        }

        [HttpGet]
        public async Task<IActionResult> Get(Guid categoryId, DateOnly from, DateOnly to)
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
            if (expenseRequestDto == null)
                return BadRequest();

            var id = HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await userManager.FindByIdAsync(id.Value);

            var expenseResponseDto = await expenseService.CreateAsync(
                user: user,
                projectId: projectId,
                categoryId: categoryId,
                expenseDto: expenseRequestDto);

            return ValidateResponse(actionName: nameof(GetById), routeValues: new { projectId, categoryId, expenseId = expenseResponseDto?.Data?.Id }, appResponse: expenseResponseDto);
        }

        [HttpPost("temporary-attachments")]
        public async Task<IActionResult> UploadTemporaryAttachmentAsync(
            Guid projectId,
            [FromForm] IFormFile file,
            [FromForm] AttachmentType attachmentType = AttachmentType.General)
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
                attachmentType: attachmentType);

            return ValidateResponse(uploadResponse, HttpStatusCode.Created);
        }

        [HttpPatch("{expenseId}")]
        public async Task<IActionResult> Update(Guid projectId, Guid categoryId, Guid expenseId, [FromBody] JsonPatchDocument<ExpenseRequestDTO> expenseDto)
        {
            if (expenseDto == null)
                return BadRequest();

            var id = HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await userManager.FindByIdAsync(id.Value);

            var result = await expenseService.UpdateAsync(
                user: user,
                projectId: projectId,
                categoryId: categoryId,
                expenseId: expenseId,
                expenseDto: expenseDto);
            return ValidateResponse(result, HttpStatusCode.OK);
        }

        [HttpDelete("{expenseId}")]
        public async Task<IActionResult> DeleteAsync(Guid expenseId)
        {
            var result = await expenseService.DeleteAsync(expenseId);
            return ValidateResponse(result, HttpStatusCode.OK);
        }

        [HttpPost("{expenseId}/attachments")]
        public async Task<IActionResult> UploadAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            [FromForm] IFormFile file,
            [FromForm] AttachmentType attachmentType = AttachmentType.General)
        {
            if (file == null || file.Length == 0)
                return BadRequest();

            var id = HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await userManager.FindByIdAsync(id.Value);

            await using var stream = file.OpenReadStream();
            var uploadResponse = await this.attachmentService.UploadExpenseAttachmentAsync(
                user: user,
                projectId: projectId,
                categoryId: categoryId,
                expenseId: expenseId,
                content: stream,
                fileName: file.FileName,
                contentType: file.ContentType,
                size: file.Length,
                attachmentType: attachmentType);

            return ValidateResponse(uploadResponse, HttpStatusCode.Created);
        }

        [HttpGet("{expenseId}/attachments/{attachmentId}")]
        public async Task<IActionResult> GetAttachmentAsync(Guid projectId, Guid categoryId, Guid expenseId, Guid attachmentId)
        {
            var fileResponse = await this.attachmentService.GetExpenseAttachmentAsync(projectId, categoryId, expenseId, attachmentId);
            if (fileResponse.Failed)
                return ValidateResponse(fileResponse, HttpStatusCode.OK);

            return File(fileResponse.Data.Content, fileResponse.Data.ContentType, fileResponse.Data.Name);
        }

        [HttpDelete("{expenseId}/attachments/{attachmentId}")]
        public async Task<IActionResult> DeleteAttachmentAsync(Guid projectId, Guid categoryId, Guid expenseId, Guid attachmentId)
        {
            var deleteResponse = await this.attachmentService.DeleteExpenseAttachmentAsync(projectId, categoryId, expenseId, attachmentId);
            return ValidateResponse(deleteResponse, HttpStatusCode.OK);
        }
    }
}
