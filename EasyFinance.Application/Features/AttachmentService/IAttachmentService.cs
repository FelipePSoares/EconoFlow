using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using FpsSoftware.Chassis;

namespace EasyFinance.Application.Features.AttachmentService
{
    public interface IAttachmentService
    {
        Task<AppResponse<AttachmentResponseDTO>> UploadTemporaryAttachmentAsync(
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

        Task<AppResponse<AttachmentResponseDTO>> UploadExpenseAttachmentAsync(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Stream content,
            string fileName,
            string contentType,
            long size,
            AttachmentType attachmentType);

        Task<AppResponse<AttachmentResponseDTO>> UploadExpenseItemAttachmentAsync(
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

        Task<AppResponse<AttachmentFileResponseDTO>> GetExpenseAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid attachmentId);

        Task<AppResponse<AttachmentFileResponseDTO>> GetExpenseItemAttachmentAsync(
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

        /// <summary>
        /// Links already-uploaded temporary attachments to an income in the current unit of work.
        /// Does not commit: the caller owns the single commit of the write path.
        /// </summary>
        Task<AppResponse> LinkTemporaryAttachmentsToIncomeAsync(
            Income income,
            User user,
            ICollection<Guid> temporaryAttachmentIds);

        Task<AppResponse<AttachmentResponseDTO>> UploadIncomeAttachmentAsync(
            User user,
            Guid projectId,
            Guid incomeId,
            Stream content,
            string fileName,
            string contentType,
            long size);

        Task<AppResponse<AttachmentFileResponseDTO>> GetIncomeAttachmentAsync(
            Guid projectId,
            Guid incomeId,
            Guid attachmentId);

        Task<AppResponse> DeleteIncomeAttachmentAsync(
            Guid projectId,
            Guid incomeId,
            Guid attachmentId);
    }
}
