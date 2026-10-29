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
using FpsSoftware.Chassis;
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

        public async Task<AppResponse<AttachmentResponseDTO>> UploadTemporaryAttachmentAsync(
            User user,
            Guid projectId,
            Stream content,
            string fileName,
            string contentType,
            long size,
            AttachmentType attachmentType)
        {
            var safeContentType = NormalizeContentType(contentType);
            content = await PrepareForStorageAsync(content, size);
            var validationResponse = ValidateTemporaryUploadInput(user, projectId, content, safeContentType, size, attachmentType, out var detectedContentType);
            if (validationResponse.Failed)
                return AppResponse<AttachmentResponseDTO>.Error(validationResponse.Messages);

            // The bytes were inspected during validation; reuse that verdict rather than
            // reading the stream a second time.
            var storedContentType = detectedContentType;

            var projectExists = await this.unitOfWork.ProjectRepository
                .NoTrackable()
                .AnyAsync(project => project.Id == projectId);

            if (!projectExists)
                return AppResponse<AttachmentResponseDTO>.Error(nameof(projectId), ValidationMessages.ProjectNotFound);

            var safeFileName = NormalizeFileName(fileName);

            string createdStorageKey = null;
            try
            {
                createdStorageKey = await this.attachmentStorageService.SaveAsync(content, safeFileName);

                var temporaryAttachment = new Attachment(
                    name: safeFileName,
                    contentType: storedContentType,
                    size: size,
                    storageKey: createdStorageKey,
                    attachmentType: attachmentType,
                    isTemporary: true,
                    createdBy: user);

                var saveAttachmentResponse = this.unitOfWork.AttachmentRepository.InsertOrUpdate(temporaryAttachment);
                if (saveAttachmentResponse.Failed)
                {
                    await SafeDeleteFileAsync(createdStorageKey);
                    return AppResponse<AttachmentResponseDTO>.Error(saveAttachmentResponse.Messages);
                }

                await this.unitOfWork.CommitAsync();

                return AppResponse<AttachmentResponseDTO>.Success(temporaryAttachment.ToAttachmentDTO());
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

        public async Task<AppResponse<AttachmentResponseDTO>> UploadExpenseAttachmentAsync(
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
            content = await PrepareForStorageAsync(content, size);
            var validationResponse = ValidateUploadInput(user, projectId, categoryId, expenseId, content, safeContentType, size, attachmentType, out var detectedContentType);
            if (validationResponse.Failed)
                return AppResponse<AttachmentResponseDTO>.Error(validationResponse.Messages);

            // The bytes were inspected during validation; reuse that verdict rather than
            // reading the stream a second time.
            var storedContentType = detectedContentType;

            var expense = await GetExpenseAsync(projectId, categoryId, expenseId, trackChanges: true);

            Attachment existingDeductibleProof = null;
            if (attachmentType == AttachmentType.DeductibleProof)
                existingDeductibleProof = expense.Attachments.FirstOrDefault(a => a.AttachmentType == AttachmentType.DeductibleProof);

            var safeFileName = NormalizeFileName(fileName);

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
                    contentType: storedContentType,
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
                    return AppResponse<AttachmentResponseDTO>.Error(saveAttachmentResponse.Messages);
                }

                await this.unitOfWork.CommitAsync();

                if (existingDeductibleProof != null)
                    await SafeDeleteFileAsync(existingDeductibleProof.StorageKey);

                return AppResponse<AttachmentResponseDTO>.Success(attachment.ToAttachmentDTO());
            }
            catch
            {
                await SafeDeleteFileAsync(createdStorageKey);
                throw;
            }
        }

        public async Task<AppResponse<AttachmentResponseDTO>> UploadExpenseItemAttachmentAsync(
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
            content = await PrepareForStorageAsync(content, size);
            var validationResponse = ValidateUploadInput(user, projectId, categoryId, expenseId, content, safeContentType, size, attachmentType, out var detectedContentType);
            if (validationResponse.Failed)
                return AppResponse<AttachmentResponseDTO>.Error(validationResponse.Messages);

            // The bytes were inspected during validation; reuse that verdict rather than
            // reading the stream a second time.
            var storedContentType = detectedContentType;

            if (expenseItemId == Guid.Empty)
                return AppResponse<AttachmentResponseDTO>.Error(nameof(expenseItemId), ValidationMessages.InvalidExpenseItemId);

            var expenseItem = await GetExpenseItemAsync(projectId, categoryId, expenseId, expenseItemId, trackChanges: true);

            var safeFileName = NormalizeFileName(fileName);

            string createdStorageKey = null;
            try
            {
                createdStorageKey = await this.attachmentStorageService.SaveAsync(content, safeFileName);

                var attachment = new Attachment(
                    name: safeFileName,
                    contentType: storedContentType,
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
                    return AppResponse<AttachmentResponseDTO>.Error(saveAttachmentResponse.Messages);
                }

                await this.unitOfWork.CommitAsync();

                return AppResponse<AttachmentResponseDTO>.Success(attachment.ToAttachmentDTO());
            }
            catch
            {
                await SafeDeleteFileAsync(createdStorageKey);
                throw;
            }
        }

        public async Task<AppResponse<AttachmentFileResponseDTO>> GetExpenseAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid attachmentId)
        {
            if (attachmentId == Guid.Empty)
                return AppResponse<AttachmentFileResponseDTO>.Error(nameof(attachmentId), ValidationMessages.InvalidAttachmentId);

            var expense = await GetExpenseAsync(projectId, categoryId, expenseId, trackChanges: false);
            var attachment = expense.Attachments.FirstOrDefault(a => a.Id == attachmentId)
                ?? throw new KeyNotFoundException(ValidationMessages.AttachmentNotFound);

            var stream = await this.attachmentStorageService.OpenReadAsync(attachment.StorageKey);

            return AppResponse<AttachmentFileResponseDTO>.Success(new AttachmentFileResponseDTO()
            {
                Name = attachment.Name,
                ContentType = attachment.ContentType,
                Content = stream
            });
        }

        public async Task<AppResponse<AttachmentFileResponseDTO>> GetExpenseItemAttachmentAsync(
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            Guid expenseItemId,
            Guid attachmentId)
        {
            if (expenseItemId == Guid.Empty)
                return AppResponse<AttachmentFileResponseDTO>.Error(nameof(expenseItemId), ValidationMessages.InvalidExpenseItemId);

            if (attachmentId == Guid.Empty)
                return AppResponse<AttachmentFileResponseDTO>.Error(nameof(attachmentId), ValidationMessages.InvalidAttachmentId);

            var expenseItem = await GetExpenseItemAsync(projectId, categoryId, expenseId, expenseItemId, trackChanges: false);
            var attachment = expenseItem.Attachments.FirstOrDefault(a => a.Id == attachmentId)
                ?? throw new KeyNotFoundException(ValidationMessages.AttachmentNotFound);

            var stream = await this.attachmentStorageService.OpenReadAsync(attachment.StorageKey);

            return AppResponse<AttachmentFileResponseDTO>.Success(new AttachmentFileResponseDTO()
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

        public async Task<AppResponse> LinkTemporaryAttachmentsToIncomeAsync(
            Income income,
            User user,
            ICollection<Guid> temporaryAttachmentIds)
        {
            if (temporaryAttachmentIds == null || temporaryAttachmentIds.Count == 0)
                return AppResponse.Success();

            if (income == null)
                return AppResponse.Error(nameof(income), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(income)));

            if (user == null)
                return AppResponse.Error(nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

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
                temporaryAttachment.SetExpenseItemId(null);

                // Adding to the income's collection lets EF assign the IncomeId foreign key when
                // the caller commits, so the income and its attachments are persisted together.
                income.AddAttachment(temporaryAttachment);
            }

            return AppResponse.Success();
        }

        public async Task<AppResponse<AttachmentResponseDTO>> UploadIncomeAttachmentAsync(
            User user,
            Guid projectId,
            Guid incomeId,
            Stream content,
            string fileName,
            string contentType,
            long size)
        {
            var safeContentType = NormalizeContentType(contentType);
            content = await PrepareForStorageAsync(content, size);
            var validationResponse = ValidateIncomeUploadInput(user, projectId, incomeId, content, safeContentType, size, out var detectedContentType);
            if (validationResponse.Failed)
                return AppResponse<AttachmentResponseDTO>.Error(validationResponse.Messages);

            // The bytes were inspected during validation; reuse that verdict rather than
            // reading the stream a second time.
            var storedContentType = detectedContentType;

            var income = await GetIncomeAsync(projectId, incomeId, trackChanges: true);

            var safeFileName = NormalizeFileName(fileName);

            string createdStorageKey = null;
            try
            {
                createdStorageKey = await this.attachmentStorageService.SaveAsync(content, safeFileName);

                var attachment = new Attachment(
                    name: safeFileName,
                    contentType: storedContentType,
                    size: size,
                    storageKey: createdStorageKey,
                    attachmentType: AttachmentType.General,
                    incomeId: income.Id,
                    createdBy: user);

                income.AddAttachment(attachment);
                var saveAttachmentResponse = this.unitOfWork.AttachmentRepository.InsertOrUpdate(attachment);
                if (saveAttachmentResponse.Failed)
                {
                    await SafeDeleteFileAsync(createdStorageKey);
                    return AppResponse<AttachmentResponseDTO>.Error(saveAttachmentResponse.Messages);
                }

                await this.unitOfWork.CommitAsync();

                return AppResponse<AttachmentResponseDTO>.Success(attachment.ToAttachmentDTO());
            }
            catch
            {
                await SafeDeleteFileAsync(createdStorageKey);
                throw;
            }
        }

        public async Task<AppResponse<AttachmentFileResponseDTO>> GetIncomeAttachmentAsync(
            Guid projectId,
            Guid incomeId,
            Guid attachmentId)
        {
            if (attachmentId == Guid.Empty)
                return AppResponse<AttachmentFileResponseDTO>.Error(nameof(attachmentId), ValidationMessages.InvalidAttachmentId);

            var income = await GetIncomeAsync(projectId, incomeId, trackChanges: false);
            var attachment = income.Attachments.FirstOrDefault(a => a.Id == attachmentId)
                ?? throw new KeyNotFoundException(ValidationMessages.AttachmentNotFound);

            var stream = await this.attachmentStorageService.OpenReadAsync(attachment.StorageKey);

            return AppResponse<AttachmentFileResponseDTO>.Success(new AttachmentFileResponseDTO()
            {
                Name = attachment.Name,
                ContentType = attachment.ContentType,
                Content = stream
            });
        }

        public async Task<AppResponse> DeleteIncomeAttachmentAsync(
            Guid projectId,
            Guid incomeId,
            Guid attachmentId)
        {
            if (attachmentId == Guid.Empty)
                return AppResponse.Error(nameof(attachmentId), ValidationMessages.InvalidAttachmentId);

            var income = await GetIncomeAsync(projectId, incomeId, trackChanges: true);
            var attachment = income.Attachments.FirstOrDefault(a => a.Id == attachmentId)
                ?? throw new KeyNotFoundException(ValidationMessages.AttachmentNotFound);

            income.RemoveAttachment(attachment);
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
            AttachmentType attachmentType,
            out string detectedContentType)
        {
            var response = ValidateContentAndAddErrors(content, contentType, size, out detectedContentType);

            if (user == null)
                response.AddErrorMessage(nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));
            if (projectId == Guid.Empty)
                response.AddErrorMessage(nameof(projectId), ValidationMessages.InvalidProjectId);
            if (categoryId == Guid.Empty)
                response.AddErrorMessage(nameof(categoryId), ValidationMessages.InvalidCategoryId);
            if (expenseId == Guid.Empty)
                response.AddErrorMessage(nameof(expenseId), ValidationMessages.InvalidExpenseId);
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
            AttachmentType attachmentType,
            out string detectedContentType)
        {
            var response = ValidateContentAndAddErrors(content, contentType, size, out detectedContentType);

            if (user == null)
                response.AddErrorMessage(nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));
            if (projectId == Guid.Empty)
                response.AddErrorMessage(nameof(projectId), ValidationMessages.InvalidProjectId);
            if (!Enum.IsDefined(typeof(AttachmentType), attachmentType))
                response.AddErrorMessage(nameof(attachmentType), ValidationMessages.InvalidAttachmentType);

            return response;
        }

        private static AppResponse ValidateIncomeUploadInput(
            User user,
            Guid projectId,
            Guid incomeId,
            Stream content,
            string contentType,
            long size,
            out string detectedContentType)
        {
            var response = ValidateContentAndAddErrors(content, contentType, size, out detectedContentType);

            if (user == null)
                response.AddErrorMessage(nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));
            if (projectId == Guid.Empty)
                response.AddErrorMessage(nameof(projectId), ValidationMessages.InvalidProjectId);
            if (incomeId == Guid.Empty)
                response.AddErrorMessage(nameof(incomeId), ValidationMessages.InvalidIncomeId);

            return response;
        }

        /// <summary>
        /// Shared content checks for every upload surface. The declared type is only the first
        /// gate: it must be on the allow-list, and the bytes must independently prove they are
        /// that type, because the declared header is supplied by the client.
        ///
        /// <para>
        /// No content is read until the length and declared-type checks have passed, so a
        /// request that is going to be refused anyway never gets its body buffered.
        /// </para>
        ///
        /// <para>
        /// The detected type is returned through <paramref name="detectedContentType"/> so the
        /// caller can store under it without reading the stream a second time.
        /// </para>
        /// </summary>
        private static AppResponse ValidateContentAndAddErrors(
            Stream content,
            string contentType,
            long size,
            out string detectedContentType)
        {
            detectedContentType = null;
            var response = AppResponse.Success();

            if (content == null)
                response.AddErrorMessage(nameof(content), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(content)));
            if (size <= 0)
                response.AddErrorMessage(nameof(size), ValidationMessages.AttachmentFileIsEmpty);
            if (size > AttachmentUploadPolicy.MaxAttachmentSizeBytes)
                response.AddErrorMessage(nameof(size), string.Format(ValidationMessages.AttachmentFileSizeExceeded, AttachmentUploadPolicy.MaxAttachmentSizeBytes / (1024 * 1024)));
            if (!AttachmentUploadPolicy.IsAllowedContentType(contentType))
            {
                response.AddErrorMessage(nameof(contentType), string.Format(ValidationMessages.AttachmentContentTypeNotSupported, AttachmentUploadPolicy.AllowedContentTypesDescription));
                return response;
            }

            if (content == null || !content.CanRead)
                return response;

            detectedContentType = AttachmentUploadPolicy.SniffContentType(content);

            if (detectedContentType == null)
            {
                // The bytes match nothing we accept - an executable, a script, or a file that
                // was truncated before its signature was complete.
                response.AddErrorMessage(nameof(contentType), ValidationMessages.AttachmentContentNotRecognized);
                return response;
            }

            var normalizedDeclared = AttachmentUploadPolicy.NormalizeContentTypeForStorage(contentType);
            if (!string.Equals(normalizedDeclared, detectedContentType, StringComparison.Ordinal))
            {
                response.AddErrorMessage(
                    nameof(contentType),
                    string.Format(ValidationMessages.AttachmentContentTypeMismatch, detectedContentType, normalizedDeclared));
            }

            return response;
        }

        /// <summary>
        /// Prepares the upload stream for validation and storage and returns it positioned at
        /// the start.
        ///
        /// <para>
        /// Signature detection needs to read the head and then leave the stream usable for the
        /// storage copy. That is free on a seekable stream but impossible on a forward-only
        /// request body, so such a stream is copied into memory once.
        /// </para>
        ///
        /// <para>
        /// Callers pass <paramref name="size"/> so an oversized body is refused before it is
        /// buffered: the only thing this method can spend memory on is an upload that is
        /// already within the size limit and declares an allowed type.
        /// </para>
        /// </summary>
        private static async Task<Stream> PrepareForStorageAsync(Stream content, long size)
        {
            if (!content.CanSeek)
            {
                // Nothing gets buffered for a request the cheap checks already reject.
                if (size <= 0 || size > AttachmentUploadPolicy.MaxAttachmentSizeBytes)
                    return content;

                var buffered = new MemoryStream();
                await content.CopyToAsync(buffered);
                buffered.Position = 0;

                return buffered;
            }

            content.Seek(0, SeekOrigin.Begin);

            return content;
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

        private async Task<Income> GetIncomeAsync(Guid projectId, Guid incomeId, bool trackChanges)
        {
            var projectQuery = trackChanges
                ? this.unitOfWork.ProjectRepository.Trackable()
                : this.unitOfWork.ProjectRepository.NoTrackable();

            var income = await projectQuery
                .Where(project => project.Id == projectId)
                .SelectMany(project => project.Incomes.Where(income => income.Id == incomeId))
                .Include(income => income.Attachments)
                .FirstOrDefaultAsync();

            return income ?? throw new KeyNotFoundException(ValidationMessages.IncomeNotFound);
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
