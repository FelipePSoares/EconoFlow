using System.Net;
using System.Security.Claims;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}/[controller]")]
    public class ExpenseItemsController : BaseController
    {
        private readonly IExpenseItemService expenseItemService;
        private readonly IAttachmentService attachmentService;
        private readonly UserManager<User> userManager;

        public ExpenseItemsController(
            IExpenseItemService expenseItemService,
            IAttachmentService attachmentService,
            UserManager<User> userManager)
        {
            this.expenseItemService = expenseItemService;
            this.attachmentService = attachmentService;
            this.userManager = userManager;
        }

        [HttpDelete("{expenseItemId}")]
        public async Task<IActionResult> DeleteAsync(Guid expenseItemId)
        {
            var result = await this.expenseItemService.DeleteAsync(expenseItemId);
            return ValidateResponse(result, HttpStatusCode.OK);
        }

        [HttpPost("temporary-attachments")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadTemporaryAttachmentAsync(
            Guid projectId,
            IFormFile file,
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

        [HttpPost("{expenseItemId}/attachments")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            IFormFile file,
            [FromForm] AttachmentType attachmentType = AttachmentType.General)
        {
            if (file == null || file.Length == 0)
                return BadRequest();

            var id = HttpContext.User.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier);
            var user = await userManager.FindByIdAsync(id.Value);

            await using var stream = file.OpenReadStream();
            var uploadResponse = await this.attachmentService.UploadExpenseItemAttachmentAsync(
                user: user,
                projectId: projectId,
                categoryId: categoryId,
                expenseId: expenseId,
                expenseItemId: expenseItemId,
                content: stream,
                fileName: file.FileName,
                contentType: file.ContentType,
                size: file.Length,
                attachmentType: attachmentType);

            return ValidateResponse(uploadResponse, HttpStatusCode.Created);
        }

        [HttpGet("{expenseItemId}/attachments/{attachmentId}")]
        public async Task<IActionResult> GetAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            Guid attachmentId)
        {
            var fileResponse = await this.attachmentService.GetExpenseItemAttachmentAsync(
                projectId,
                categoryId,
                expenseId,
                expenseItemId,
                attachmentId);

            if (fileResponse.Failed)
                return ValidateResponse(fileResponse, HttpStatusCode.OK);

            return File(fileResponse.Data.Content, fileResponse.Data.ContentType, fileResponse.Data.Name);
        }

        [HttpDelete("{expenseItemId}/attachments/{attachmentId}")]
        public async Task<IActionResult> DeleteAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            Guid attachmentId)
        {
            var deleteResponse = await this.attachmentService.DeleteExpenseItemAttachmentAsync(
                projectId,
                categoryId,
                expenseId,
                expenseItemId,
                attachmentId);

            return ValidateResponse(deleteResponse, HttpStatusCode.OK);
        }
    }
}
