using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.AttachmentService
{
    public interface IAttachmentService
    {
        Task<AppResponse<ExpenseAttachmentResponseDTO>> UploadTemporaryAttachmentAsync(
            User user,
            Guid projectId,
            Stream content,
            string fileName,
            string contentType,
            long size,
            AttachmentType attachmentType);

        Task<AppResponse> AttachTemporaryToExpenseAsync(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            ICollection<Guid> temporaryAttachmentIds);

        Task<AppResponse> AttachTemporaryToExpenseItemAsync(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            ICollection<Guid> temporaryAttachmentIds);

        Task<AppResponse<ExpenseAttachmentResponseDTO>> UploadExpenseAttachmentAsync(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Stream content,
            string fileName,
            string contentType,
            long size,
            AttachmentType attachmentType);

        Task<AppResponse<ExpenseAttachmentResponseDTO>> UploadExpenseItemAttachmentAsync(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            Stream content,
            string fileName,
            string contentType,
            long size,
            AttachmentType attachmentType);

        Task<AppResponse<ExpenseAttachmentFileResponseDTO>> GetExpenseAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid attachmentId);

        Task<AppResponse<ExpenseAttachmentFileResponseDTO>> GetExpenseItemAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            Guid attachmentId);

        Task<AppResponse> DeleteExpenseAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid attachmentId);

        Task<AppResponse> DeleteExpenseItemAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            Guid attachmentId);
    }
}
