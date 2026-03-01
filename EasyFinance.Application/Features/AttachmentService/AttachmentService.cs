using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.Features.AttachmentService
{
    public class AttachmentService : IAttachmentService
    {
        private readonly IUnitOfWork unitOfWork;
        private readonly IAttachmentStorageService attachmentStorageService;
        private readonly ILogger<AttachmentService> logger;

        public AttachmentService(
            IUnitOfWork unitOfWork,
            IAttachmentStorageService attachmentStorageService,
            ILogger<AttachmentService> logger)
        {
            this.unitOfWork = unitOfWork;
            this.attachmentStorageService = attachmentStorageService;
            this.logger = logger;
        }

        public async Task<AppResponse<ExpenseAttachmentResponseDTO>> UploadTemporaryAttachmentAsync(
            User user,
            Guid projectId,
            Stream content,
            string fileName,
            string contentType,
            long size,
            AttachmentType attachmentType)
        {
            var safeContentType = NormalizeContentType(contentType);
            var validationResponse = ValidateTemporaryUploadInput(user, projectId, content, safeContentType, size, attachmentType);
            if (validationResponse.Failed)
                return AppResponse<ExpenseAttachmentResponseDTO>.Error(validationResponse.Messages);

            var projectExists = await this.unitOfWork.ProjectRepository
                .NoTrackable()
                .AnyAsync(project => project.Id == projectId);

            if (!projectExists)
                return AppResponse<ExpenseAttachmentResponseDTO>.Error(nameof(projectId), ValidationMessages.ProjectNotFound);

            var safeFileName = NormalizeFileName(fileName);

            if (content.CanSeek)
                content.Seek(0, SeekOrigin.Begin);

            string createdStorageKey = null;
            try
            {
                createdStorageKey = await this.attachmentStorageService.SaveAsync(content, safeFileName);

                var temporaryAttachment = new Attachment(
                    name: safeFileName,
                    contentType: safeContentType,
                    size: size,
                    storageKey: createdStorageKey,
                    attachmentType: attachmentType,
                    isTemporary: true,
                    createdBy: user);

                var saveAttachmentResponse = this.unitOfWork.AttachmentRepository.InsertOrUpdate(temporaryAttachment);
                if (saveAttachmentResponse.Failed)
                {
                    await SafeDeleteFileAsync(createdStorageKey);
                    return AppResponse<ExpenseAttachmentResponseDTO>.Error(saveAttachmentResponse.Messages);
                }

                await this.unitOfWork.CommitAsync();

                return AppResponse<ExpenseAttachmentResponseDTO>.Success(temporaryAttachment.ToExpenseAttachmentDTO());
            }
            catch
            {
                await SafeDeleteFileAsync(createdStorageKey);
                throw;
            }
        }

        public async Task<AppResponse> AttachTemporaryToExpenseAsync(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            ICollection<Guid> temporaryAttachmentIds)
        {
            if (temporaryAttachmentIds == null || temporaryAttachmentIds.Count == 0)
                return AppResponse.Success();

            if (user == null)
                return AppResponse.Error(nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

            var expense = await GetExpenseAsync(projectId, categoryId, expenseId, trackChanges: true);

            var temporaryIds = temporaryAttachmentIds
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList();

            if (temporaryIds.Count == 0)
                return AppResponse.Success();

            var temporaryAttachments = await this.unitOfWork.AttachmentRepository
                .Trackable()
                .Include(attachment => attachment.CreatedBy)
                .Where(attachment =>
                    temporaryIds.Contains(attachment.Id) &&
                    attachment.IsTemporary &&
                    attachment.ExpenseId == null &&
                    attachment.ExpenseItemId == null &&
                    attachment.IncomeId == null &&
                    attachment.CreatedBy.Id == user.Id)
                .ToListAsync();

            if (temporaryAttachments.Count != temporaryIds.Count)
                return AppResponse.Error(nameof(temporaryAttachmentIds), ValidationMessages.TemporaryAttachmentNotFoundOrInvalid);

            var storageKeysToDelete = new List<string>();

            foreach (var temporaryAttachment in temporaryAttachments)
            {
                if (temporaryAttachment.AttachmentType == AttachmentType.DeductibleProof)
                {
                    var currentDeductibleProof = expense.Attachments
                        .FirstOrDefault(attachment => attachment.AttachmentType == AttachmentType.DeductibleProof && !attachment.IsTemporary);

                    if (currentDeductibleProof != null)
                    {
                        expense.RemoveAttachment(currentDeductibleProof);
                        this.unitOfWork.AttachmentRepository.Delete(currentDeductibleProof);
                        storageKeysToDelete.Add(currentDeductibleProof.StorageKey);
                    }
                }

                temporaryAttachment.SetIsTemporary(false);
                temporaryAttachment.SetExpenseId(expense.Id);
                temporaryAttachment.SetExpenseItemId(null);
                temporaryAttachment.SetIncomeId(null);

                expense.AddAttachment(temporaryAttachment);
                var saveAttachmentResponse = this.unitOfWork.AttachmentRepository.InsertOrUpdate(temporaryAttachment);
                if (saveAttachmentResponse.Failed)
                    return AppResponse.Error(saveAttachmentResponse.Messages);
            }

            await this.unitOfWork.CommitAsync();

            foreach (var storageKey in storageKeysToDelete.Where(key => !string.IsNullOrWhiteSpace(key)).Distinct())
                await SafeDeleteFileAsync(storageKey);

            return AppResponse.Success();
        }

        public async Task<AppResponse> AttachTemporaryToExpenseItemAsync(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            ICollection<Guid> temporaryAttachmentIds)
        {
            if (temporaryAttachmentIds == null || temporaryAttachmentIds.Count == 0)
                return AppResponse.Success();

            if (user == null)
                return AppResponse.Error(nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

            if (expenseItemId == Guid.Empty)
                return AppResponse.Error(nameof(expenseItemId), ValidationMessages.InvalidExpenseItemId);

            var expenseItem = await GetExpenseItemAsync(projectId, categoryId, expenseId, expenseItemId, trackChanges: true);

            var temporaryIds = temporaryAttachmentIds
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList();

            if (temporaryIds.Count == 0)
                return AppResponse.Success();

            var temporaryAttachments = await this.unitOfWork.AttachmentRepository
                .Trackable()
                .Include(attachment => attachment.CreatedBy)
                .Where(attachment =>
                    temporaryIds.Contains(attachment.Id) &&
                    attachment.IsTemporary &&
                    attachment.ExpenseId == null &&
                    attachment.ExpenseItemId == null &&
                    attachment.IncomeId == null &&
                    attachment.CreatedBy.Id == user.Id)
                .ToListAsync();

            if (temporaryAttachments.Count != temporaryIds.Count)
                return AppResponse.Error(nameof(temporaryAttachmentIds), ValidationMessages.TemporaryAttachmentNotFoundOrInvalid);

            foreach (var temporaryAttachment in temporaryAttachments)
            {
                temporaryAttachment.SetIsTemporary(false);
                temporaryAttachment.SetExpenseId(null);
                temporaryAttachment.SetExpenseItemId(expenseItem.Id);
                temporaryAttachment.SetIncomeId(null);

                expenseItem.AddAttachment(temporaryAttachment);
                var saveAttachmentResponse = this.unitOfWork.AttachmentRepository.InsertOrUpdate(temporaryAttachment);
                if (saveAttachmentResponse.Failed)
                    return AppResponse.Error(saveAttachmentResponse.Messages);
            }

            await this.unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse<ExpenseAttachmentResponseDTO>> UploadExpenseAttachmentAsync(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Stream content,
            string fileName,
            string contentType,
            long size,
            AttachmentType attachmentType)
        {
            var safeContentType = NormalizeContentType(contentType);
            var validationResponse = ValidateUploadInput(user, projectId, categoryId, expenseId, content, safeContentType, size, attachmentType);
            if (validationResponse.Failed)
                return AppResponse<ExpenseAttachmentResponseDTO>.Error(validationResponse.Messages);

            var expense = await GetExpenseAsync(projectId, categoryId, expenseId, trackChanges: true);

            Attachment existingDeductibleProof = null;
            if (attachmentType == AttachmentType.DeductibleProof)
                existingDeductibleProof = expense.Attachments.FirstOrDefault(a => a.AttachmentType == AttachmentType.DeductibleProof);

            var safeFileName = NormalizeFileName(fileName);

            if (content.CanSeek)
                content.Seek(0, SeekOrigin.Begin);

            string createdStorageKey = null;
            try
            {
                createdStorageKey = await this.attachmentStorageService.SaveAsync(content, safeFileName);

                if (existingDeductibleProof != null)
                {
                    expense.RemoveAttachment(existingDeductibleProof);
                    this.unitOfWork.AttachmentRepository.Delete(existingDeductibleProof);
                }

                var attachment = new Attachment(
                    name: safeFileName,
                    contentType: safeContentType,
                    size: size,
                    storageKey: createdStorageKey,
                    attachmentType: attachmentType,
                    expenseId: expense.Id,
                    createdBy: user);

                expense.AddAttachment(attachment);
                var saveAttachmentResponse = this.unitOfWork.AttachmentRepository.InsertOrUpdate(attachment);
                if (saveAttachmentResponse.Failed)
                {
                    await SafeDeleteFileAsync(createdStorageKey);
                    return AppResponse<ExpenseAttachmentResponseDTO>.Error(saveAttachmentResponse.Messages);
                }

                await this.unitOfWork.CommitAsync();

                if (existingDeductibleProof != null)
                    await SafeDeleteFileAsync(existingDeductibleProof.StorageKey);

                return AppResponse<ExpenseAttachmentResponseDTO>.Success(attachment.ToExpenseAttachmentDTO());
            }
            catch
            {
                await SafeDeleteFileAsync(createdStorageKey);
                throw;
            }
        }

        public async Task<AppResponse<ExpenseAttachmentResponseDTO>> UploadExpenseItemAttachmentAsync(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            Stream content,
            string fileName,
            string contentType,
            long size,
            AttachmentType attachmentType)
        {
            var safeContentType = NormalizeContentType(contentType);
            var validationResponse = ValidateUploadInput(user, projectId, categoryId, expenseId, content, safeContentType, size, attachmentType);
            if (validationResponse.Failed)
                return AppResponse<ExpenseAttachmentResponseDTO>.Error(validationResponse.Messages);

            if (expenseItemId == Guid.Empty)
                return AppResponse<ExpenseAttachmentResponseDTO>.Error(nameof(expenseItemId), ValidationMessages.InvalidExpenseItemId);

            var expenseItem = await GetExpenseItemAsync(projectId, categoryId, expenseId, expenseItemId, trackChanges: true);

            var safeFileName = NormalizeFileName(fileName);

            if (content.CanSeek)
                content.Seek(0, SeekOrigin.Begin);

            string createdStorageKey = null;
            try
            {
                createdStorageKey = await this.attachmentStorageService.SaveAsync(content, safeFileName);

                var attachment = new Attachment(
                    name: safeFileName,
                    contentType: safeContentType,
                    size: size,
                    storageKey: createdStorageKey,
                    attachmentType: attachmentType,
                    expenseItemId: expenseItem.Id,
                    createdBy: user);

                expenseItem.AddAttachment(attachment);
                var saveAttachmentResponse = this.unitOfWork.AttachmentRepository.InsertOrUpdate(attachment);
                if (saveAttachmentResponse.Failed)
                {
                    await SafeDeleteFileAsync(createdStorageKey);
                    return AppResponse<ExpenseAttachmentResponseDTO>.Error(saveAttachmentResponse.Messages);
                }

                await this.unitOfWork.CommitAsync();

                return AppResponse<ExpenseAttachmentResponseDTO>.Success(attachment.ToExpenseAttachmentDTO());
            }
            catch
            {
                await SafeDeleteFileAsync(createdStorageKey);
                throw;
            }
        }

        public async Task<AppResponse<ExpenseAttachmentFileResponseDTO>> GetExpenseAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid attachmentId)
        {
            if (attachmentId == Guid.Empty)
                return AppResponse<ExpenseAttachmentFileResponseDTO>.Error(nameof(attachmentId), ValidationMessages.InvalidAttachmentId);

            var expense = await GetExpenseAsync(projectId, categoryId, expenseId, trackChanges: false);
            var attachment = expense.Attachments.FirstOrDefault(a => a.Id == attachmentId)
                ?? throw new KeyNotFoundException(ValidationMessages.AttachmentNotFound);

            var stream = await this.attachmentStorageService.OpenReadAsync(attachment.StorageKey);

            return AppResponse<ExpenseAttachmentFileResponseDTO>.Success(new ExpenseAttachmentFileResponseDTO()
            {
                Name = attachment.Name,
                ContentType = attachment.ContentType,
                Content = stream
            });
        }

        public async Task<AppResponse<ExpenseAttachmentFileResponseDTO>> GetExpenseItemAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            Guid attachmentId)
        {
            if (expenseItemId == Guid.Empty)
                return AppResponse<ExpenseAttachmentFileResponseDTO>.Error(nameof(expenseItemId), ValidationMessages.InvalidExpenseItemId);

            if (attachmentId == Guid.Empty)
                return AppResponse<ExpenseAttachmentFileResponseDTO>.Error(nameof(attachmentId), ValidationMessages.InvalidAttachmentId);

            var expenseItem = await GetExpenseItemAsync(projectId, categoryId, expenseId, expenseItemId, trackChanges: false);
            var attachment = expenseItem.Attachments.FirstOrDefault(a => a.Id == attachmentId)
                ?? throw new KeyNotFoundException(ValidationMessages.AttachmentNotFound);

            var stream = await this.attachmentStorageService.OpenReadAsync(attachment.StorageKey);

            return AppResponse<ExpenseAttachmentFileResponseDTO>.Success(new ExpenseAttachmentFileResponseDTO()
            {
                Name = attachment.Name,
                ContentType = attachment.ContentType,
                Content = stream
            });
        }

        public async Task<AppResponse> DeleteExpenseAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid attachmentId)
        {
            if (attachmentId == Guid.Empty)
                return AppResponse.Error(nameof(attachmentId), ValidationMessages.InvalidAttachmentId);

            var expense = await GetExpenseAsync(projectId, categoryId, expenseId, trackChanges: true);
            var attachment = expense.Attachments.FirstOrDefault(a => a.Id == attachmentId)
                ?? throw new KeyNotFoundException(ValidationMessages.AttachmentNotFound);

            expense.RemoveAttachment(attachment);
            this.unitOfWork.AttachmentRepository.Delete(attachment);
            await this.unitOfWork.CommitAsync();
            await SafeDeleteFileAsync(attachment.StorageKey);

            return AppResponse.Success();
        }

        public async Task<AppResponse> DeleteExpenseItemAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            Guid attachmentId)
        {
            if (expenseItemId == Guid.Empty)
                return AppResponse.Error(nameof(expenseItemId), ValidationMessages.InvalidExpenseItemId);

            if (attachmentId == Guid.Empty)
                return AppResponse.Error(nameof(attachmentId), ValidationMessages.InvalidAttachmentId);

            var expenseItem = await GetExpenseItemAsync(projectId, categoryId, expenseId, expenseItemId, trackChanges: true);
            var attachment = expenseItem.Attachments.FirstOrDefault(a => a.Id == attachmentId)
                ?? throw new KeyNotFoundException(ValidationMessages.AttachmentNotFound);

            expenseItem.RemoveAttachment(attachment);
            this.unitOfWork.AttachmentRepository.Delete(attachment);
            await this.unitOfWork.CommitAsync();
            await SafeDeleteFileAsync(attachment.StorageKey);

            return AppResponse.Success();
        }

        private static AppResponse ValidateUploadInput(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Stream content,
            string contentType,
            long size,
            AttachmentType attachmentType)
        {
            var response = AppResponse.Success();

            if (user == null)
                response.AddErrorMessage(nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));
            if (projectId == Guid.Empty)
                response.AddErrorMessage(nameof(projectId), ValidationMessages.InvalidProjectId);
            if (categoryId == Guid.Empty)
                response.AddErrorMessage(nameof(categoryId), ValidationMessages.InvalidCategoryId);
            if (expenseId == Guid.Empty)
                response.AddErrorMessage(nameof(expenseId), ValidationMessages.InvalidExpenseId);
            if (content == null)
                response.AddErrorMessage(nameof(content), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(content)));
            if (size <= 0)
                response.AddErrorMessage(nameof(size), ValidationMessages.AttachmentFileIsEmpty);
            if (size > AttachmentUploadPolicy.MaxAttachmentSizeBytes)
                response.AddErrorMessage(nameof(size), string.Format(ValidationMessages.AttachmentFileSizeExceeded, AttachmentUploadPolicy.MaxAttachmentSizeBytes / (1024 * 1024)));
            if (!AttachmentUploadPolicy.IsAllowedContentType(contentType))
                response.AddErrorMessage(nameof(contentType), string.Format(ValidationMessages.AttachmentContentTypeNotSupported, AttachmentUploadPolicy.AllowedContentTypesDescription));
            if (!Enum.IsDefined(typeof(AttachmentType), attachmentType))
                response.AddErrorMessage(nameof(attachmentType), ValidationMessages.InvalidAttachmentType);

            return response;
        }

        private static AppResponse ValidateTemporaryUploadInput(
            User user,
            Guid projectId,
            Stream content,
            string contentType,
            long size,
            AttachmentType attachmentType)
        {
            var response = AppResponse.Success();

            if (user == null)
                response.AddErrorMessage(nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));
            if (projectId == Guid.Empty)
                response.AddErrorMessage(nameof(projectId), ValidationMessages.InvalidProjectId);
            if (content == null)
                response.AddErrorMessage(nameof(content), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(content)));
            if (size <= 0)
                response.AddErrorMessage(nameof(size), ValidationMessages.AttachmentFileIsEmpty);
            if (size > AttachmentUploadPolicy.MaxAttachmentSizeBytes)
                response.AddErrorMessage(nameof(size), string.Format(ValidationMessages.AttachmentFileSizeExceeded, AttachmentUploadPolicy.MaxAttachmentSizeBytes / (1024 * 1024)));
            if (!AttachmentUploadPolicy.IsAllowedContentType(contentType))
                response.AddErrorMessage(nameof(contentType), string.Format(ValidationMessages.AttachmentContentTypeNotSupported, AttachmentUploadPolicy.AllowedContentTypesDescription));
            if (!Enum.IsDefined(typeof(AttachmentType), attachmentType))
                response.AddErrorMessage(nameof(attachmentType), ValidationMessages.InvalidAttachmentType);

            return response;
        }

        private async Task<Expense> GetExpenseAsync(Guid projectId, Guid categoryId, Guid expenseId, bool trackChanges)
        {
            var projectQuery = trackChanges
                ? this.unitOfWork.ProjectRepository.Trackable()
                : this.unitOfWork.ProjectRepository.NoTrackable();

            var expense = await projectQuery
                .Where(project => project.Id == projectId)
                .SelectMany(project => project.Categories.Where(category => category.Id == categoryId))
                .SelectMany(category => category.Expenses.Where(expense => expense.Id == expenseId))
                .Include(expense => expense.Attachments)
                .FirstOrDefaultAsync();

            return expense ?? throw new KeyNotFoundException(ValidationMessages.ExpenseNotFound);
        }

        private async Task<ExpenseItem> GetExpenseItemAsync(Guid projectId, Guid categoryId, Guid expenseId, Guid expenseItemId, bool trackChanges)
        {
            var projectQuery = trackChanges
                ? this.unitOfWork.ProjectRepository.Trackable()
                : this.unitOfWork.ProjectRepository.NoTrackable();

            var expenseItem = await projectQuery
                .Where(project => project.Id == projectId)
                .SelectMany(project => project.Categories.Where(category => category.Id == categoryId))
                .SelectMany(category => category.Expenses.Where(expense => expense.Id == expenseId))
                .SelectMany(expense => expense.Items.Where(item => item.Id == expenseItemId))
                .Include(item => item.Attachments)
                .FirstOrDefaultAsync();

            return expenseItem ?? throw new KeyNotFoundException(ValidationMessages.ExpenseItemNotFound);
        }

        private static string NormalizeFileName(string fileName)
        {
            var safeFileName = Path.GetFileName(fileName);
            if (string.IsNullOrWhiteSpace(safeFileName))
                safeFileName = $"attachment-{Guid.NewGuid():N}";

            return safeFileName;
        }

        private static string NormalizeContentType(string contentType)
        {
            if (string.IsNullOrWhiteSpace(contentType))
                return "application/octet-stream";

            return contentType.Trim();
        }

        private async Task SafeDeleteFileAsync(string storageKey)
        {
            if (string.IsNullOrWhiteSpace(storageKey))
                return;

            try
            {
                await this.attachmentStorageService.DeleteAsync(storageKey);
            }
            catch (Exception ex)
            {
                this.logger.LogWarning(ex, "Failed to delete attachment file from storage. StorageKey={StorageKey}", storageKey);
            }
        }
    }
}
