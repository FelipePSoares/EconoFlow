using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.Files;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.Shared;
using EasyFinance.Infrastructure;
using FluentAssertions;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class AttachmentServiceTests : EasyFinance.Common.Tests.BaseTests
    {
        public AttachmentServiceTests()
        {
            PrepareInMemoryDatabase();
        }

        [Fact]
        public async Task CreateExpense_WithIsDeductible_ShouldPersistAndReturn()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var categoryId = this.project1.Categories.First().Id;
            var expense = new ExpenseRequestDTO()
            {
                Name = "Tax Expense",
                Date = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                Amount = 120,
                Budget = 120,
                IsDeductible = true,
            };

            var createResponse = await expenseService.CreateAsync(this.user1, this.project1.Id, categoryId, expense);
            createResponse.Succeeded.Should().BeTrue();
            createResponse.Data.IsDeductible.Should().BeTrue();

            var loadedExpenseResponse = await expenseService.GetByIdAsync(createResponse.Data.Id);
            loadedExpenseResponse.Succeeded.Should().BeTrue();
            loadedExpenseResponse.Data.IsDeductible.Should().BeTrue();

            var loadedExpense = unitOfWork.ExpenseRepository.NoTrackable().First(p => p.Id == createResponse.Data.Id);
            loadedExpense.IsDeductible.Should().BeTrue();
        }

        [Fact]
        public async Task UploadExpenseAttachment_ShouldCreateMetadataAndStoreFile()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var category = this.project1.Categories.First();
            var expense = category.Expenses.First();
            var payload = AttachmentTestFiles.Pdf;

            await using var stream = new MemoryStream(payload);
            var uploadResponse = await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                content: stream,
                fileName: "receipt.pdf",
                contentType: "application/pdf",
                size: payload.LongLength,
                attachmentType: AttachmentType.DeductibleProof);

            uploadResponse.Succeeded.Should().BeTrue();
            var savedAttachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == uploadResponse.Data.Id);
            savedAttachment.ExpenseId.Should().Be(expense.Id);
            savedAttachment.ExpenseItemId.Should().BeNull();
            savedAttachment.StorageKey.Should().NotBeNullOrWhiteSpace();
            ExistsInStorage(savedAttachment.StorageKey).Should().BeTrue();
        }

        [Fact]
        public async Task UploadExpenseItemAttachment_ShouldCreateMetadataAndStoreFile()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var category = this.project1.Categories.First();
            var expense = category.Expenses.First();
            var expenseItem = expense.Items.First();
            var payload = AttachmentTestFiles.Png;

            await using var stream = new MemoryStream(payload);
            var uploadResponse = await attachmentService.UploadExpenseItemAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                expenseItemId: expenseItem.Id,
                content: stream,
                fileName: "item-proof.png",
                contentType: "image/png",
                size: payload.LongLength,
                attachmentType: AttachmentType.General);

            uploadResponse.Succeeded.Should().BeTrue();
            var savedAttachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == uploadResponse.Data.Id);
            savedAttachment.ExpenseItemId.Should().Be(expenseItem.Id);
            savedAttachment.ExpenseId.Should().BeNull();
            ExistsInStorage(savedAttachment.StorageKey).Should().BeTrue();
        }

        [Fact]
        public async Task AttachTemporaryToExpenseItem_ShouldMoveTemporaryAttachmentToExpenseItem()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var category = this.project1.Categories.First();
            var expense = category.Expenses.First();
            var expenseItem = expense.Items.First();
            var payload = AttachmentTestFiles.Pdf;

            await using var uploadStream = new MemoryStream(payload);
            var temporaryUploadResponse = await attachmentService.UploadTemporaryAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                content: uploadStream,
                fileName: "temp-item-proof.pdf",
                contentType: "application/pdf",
                size: payload.LongLength,
                attachmentType: AttachmentType.General);

            temporaryUploadResponse.Succeeded.Should().BeTrue();

            var attachResponse = await attachmentService.AttachTemporaryToExpenseItemAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                expenseItemId: expenseItem.Id,
                temporaryAttachmentIds: new[] { temporaryUploadResponse.Data.Id });

            attachResponse.Succeeded.Should().BeTrue();

            var savedAttachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == temporaryUploadResponse.Data.Id);
            savedAttachment.IsTemporary.Should().BeFalse();
            savedAttachment.ExpenseItemId.Should().Be(expenseItem.Id);
            savedAttachment.ExpenseId.Should().BeNull();
            savedAttachment.IncomeId.Should().BeNull();
        }

        [Fact]
        public async Task UploadDeductibleProofTwice_ShouldKeepOnlyOneAttachment()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var category = this.project1.Categories.First();
            var expense = category.Expenses.First();

            await using var firstStream = new MemoryStream(AttachmentTestFiles.Pdf);
            var firstUploadResponse = await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                content: firstStream,
                fileName: "proof-1.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Pdf.LongLength,
                attachmentType: AttachmentType.DeductibleProof);

            firstUploadResponse.Succeeded.Should().BeTrue();
            var firstAttachmentStorageKey = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == firstUploadResponse.Data.Id).StorageKey;

            await using var secondStream = new MemoryStream(AttachmentTestFiles.Pdf);
            var secondUploadResponse = await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                content: secondStream,
                fileName: "proof-2.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Pdf.LongLength,
                attachmentType: AttachmentType.DeductibleProof);

            secondUploadResponse.Succeeded.Should().BeTrue();

            var deductibleProofs = unitOfWork.AttachmentRepository.NoTrackable()
                .Where(a => a.ExpenseId == expense.Id && a.AttachmentType == AttachmentType.DeductibleProof)
                .ToList();

            deductibleProofs.Should().HaveCount(1);
            deductibleProofs.Single().Id.Should().Be(secondUploadResponse.Data.Id);
            ExistsInStorage(firstAttachmentStorageKey).Should().BeFalse();
            ExistsInStorage(deductibleProofs.Single().StorageKey).Should().BeTrue();
        }

        [Fact]
        public async Task DeleteAttachment_ShouldRemoveMetadataAndStoredFile()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var category = this.project1.Categories.First();
            var expense = category.Expenses.First();

            await using var stream = new MemoryStream(AttachmentTestFiles.Pdf);
            var uploadResponse = await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                content: stream,
                fileName: "delete-me.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Pdf.LongLength,
                attachmentType: AttachmentType.General);

            uploadResponse.Succeeded.Should().BeTrue();
            var attachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == uploadResponse.Data.Id);
            var storageKey = attachment.StorageKey;
            ExistsInStorage(storageKey).Should().BeTrue();

            var deleteResponse = await attachmentService.DeleteExpenseAttachmentAsync(this.project1.Id, category.Id, expense.Id, attachment.Id);
            deleteResponse.Succeeded.Should().BeTrue();

            unitOfWork.AttachmentRepository.NoTrackable().Any(a => a.Id == attachment.Id).Should().BeFalse();
            ExistsInStorage(storageKey).Should().BeFalse();
        }

        [Fact]
        public async Task UploadAttachment_WithMismatchedProjectCategory_ShouldThrowNotFound()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();

            var foreignCategory = this.project2.Categories.First();
            var foreignExpense = foreignCategory.Expenses.First();

            await using var stream = new MemoryStream(AttachmentTestFiles.Pdf);
            var action = async () => await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: foreignCategory.Id,
                expenseId: foreignExpense.Id,
                content: stream,
                fileName: "not-allowed.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Pdf.LongLength,
                attachmentType: AttachmentType.General);

            await action.Should().ThrowAsync<KeyNotFoundException>();
        }

        [Fact]
        public async Task UploadIncomeAttachment_ShouldCreateMetadataAndStoreFile()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();
            var payload = AttachmentTestFiles.Pdf;

            await using var stream = new MemoryStream(payload);
            var uploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: stream,
                fileName: "payslip-january.pdf",
                contentType: "application/pdf",
                size: payload.LongLength);

            uploadResponse.Succeeded.Should().BeTrue();
            uploadResponse.Data.AttachmentType.Should().Be(AttachmentType.General);
            uploadResponse.Data.IsTemporary.Should().BeFalse();
            uploadResponse.Data.ContentType.Should().Be("application/pdf");

            var savedAttachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == uploadResponse.Data.Id);
            savedAttachment.IncomeId.Should().Be(income.Id);
            savedAttachment.ExpenseId.Should().BeNull();
            savedAttachment.ExpenseItemId.Should().BeNull();
            savedAttachment.StorageKey.Should().NotBeNullOrWhiteSpace();
            ExistsInStorage(savedAttachment.StorageKey).Should().BeTrue();
        }

        [Fact]
        public async Task UploadIncomeAttachment_Twice_ShouldKeepBothAttachments()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();

            await using var firstStream = new MemoryStream(AttachmentTestFiles.Pdf);
            var firstUploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: firstStream,
                fileName: "payslip-1.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Pdf.LongLength);

            firstUploadResponse.Succeeded.Should().BeTrue();

            await using var secondStream = new MemoryStream(AttachmentTestFiles.Pdf);
            var secondUploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: secondStream,
                fileName: "payslip-2.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Pdf.LongLength);

            secondUploadResponse.Succeeded.Should().BeTrue();

            var attachments = unitOfWork.AttachmentRepository.NoTrackable()
                .Where(a => a.IncomeId == income.Id)
                .ToList();

            attachments.Should().HaveCount(2);
            attachments.Select(a => a.Name).Should().BeEquivalentTo(new[] { "payslip-1.pdf", "payslip-2.pdf" });
            attachments.Should().OnlyContain(a => ExistsInStorage(a.StorageKey));
        }

        [Fact]
        public async Task LinkTemporaryAttachmentsToIncome_ShouldMoveTemporaryAttachmentToIncome()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();
            var payload = AttachmentTestFiles.Pdf;

            await using var uploadStream = new MemoryStream(payload);
            var temporaryUploadResponse = await attachmentService.UploadTemporaryAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                content: uploadStream,
                fileName: "temp-payslip.pdf",
                contentType: "application/pdf",
                size: payload.LongLength,
                attachmentType: AttachmentType.General);

            temporaryUploadResponse.Succeeded.Should().BeTrue();

            var trackedIncome = await unitOfWork.IncomeRepository
                .Trackable()
                .Include(i => i.Attachments)
                .FirstAsync(i => i.Id == income.Id);

            var linkResponse = await attachmentService.LinkTemporaryAttachmentsToIncomeAsync(
                trackedIncome,
                this.user1,
                new[] { temporaryUploadResponse.Data.Id });

            linkResponse.Succeeded.Should().BeTrue();

            await unitOfWork.CommitAsync();

            var savedAttachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == temporaryUploadResponse.Data.Id);
            savedAttachment.IsTemporary.Should().BeFalse();
            savedAttachment.IncomeId.Should().Be(income.Id);
            savedAttachment.ExpenseId.Should().BeNull();
            savedAttachment.ExpenseItemId.Should().BeNull();
        }

        [Fact]
        public async Task LinkTemporaryAttachmentsToIncome_WithUnknownAttachment_ShouldFail()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();

            var trackedIncome = await unitOfWork.IncomeRepository
                .Trackable()
                .Include(i => i.Attachments)
                .FirstAsync(i => i.Id == income.Id);

            var linkResponse = await attachmentService.LinkTemporaryAttachmentsToIncomeAsync(
                trackedIncome,
                this.user1,
                new[] { Guid.NewGuid() });

            linkResponse.Succeeded.Should().BeFalse();
        }

        [Fact]
        public async Task GetIncomeAttachment_ShouldReturnFileContent()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();

            var income = this.project1.Incomes.First();
            var payload = AttachmentTestFiles.Pdf;

            await using var stream = new MemoryStream(payload);
            var uploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: stream,
                fileName: "payslip.pdf",
                contentType: "application/pdf",
                size: payload.LongLength);

            uploadResponse.Succeeded.Should().BeTrue();

            var fileResponse = await attachmentService.GetIncomeAttachmentAsync(
                this.project1.Id,
                income.Id,
                uploadResponse.Data.Id);

            fileResponse.Succeeded.Should().BeTrue();
            fileResponse.Data.Name.Should().Be("payslip.pdf");
            fileResponse.Data.ContentType.Should().Be("application/pdf");

            await using var content = fileResponse.Data.Content;
            using var buffer = new MemoryStream();
            await content.CopyToAsync(buffer);
            buffer.ToArray().Should().Equal(payload);
        }

        [Fact]
        public async Task DeleteIncomeAttachment_ShouldRemoveMetadataAndStoredFile()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();

            await using var stream = new MemoryStream(AttachmentTestFiles.Pdf);
            var uploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: stream,
                fileName: "delete-me.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Pdf.LongLength);

            uploadResponse.Succeeded.Should().BeTrue();
            var attachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == uploadResponse.Data.Id);
            var storageKey = attachment.StorageKey;
            ExistsInStorage(storageKey).Should().BeTrue();

            var deleteResponse = await attachmentService.DeleteIncomeAttachmentAsync(this.project1.Id, income.Id, attachment.Id);
            deleteResponse.Succeeded.Should().BeTrue();

            unitOfWork.AttachmentRepository.NoTrackable().Any(a => a.Id == attachment.Id).Should().BeFalse();
            ExistsInStorage(storageKey).Should().BeFalse();
        }

        [Fact]
        public async Task UploadIncomeAttachment_WithMismatchedProject_ShouldThrowNotFound()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();

            var foreignIncome = this.project2.Incomes.First();

            await using var stream = new MemoryStream(AttachmentTestFiles.Pdf);
            var action = async () => await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: foreignIncome.Id,
                content: stream,
                fileName: "not-allowed.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Pdf.LongLength);

            await action.Should().ThrowAsync<KeyNotFoundException>();
        }

        [Fact]
        public async Task UploadIncomeAttachment_WithDisallowedContentType_ShouldRejectWithoutStoring()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();
            var payload = AttachmentTestFiles.WindowsExecutable;

            await using var stream = new MemoryStream(payload);
            var uploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: stream,
                fileName: "payload.exe",
                contentType: "application/x-msdownload",
                size: payload.LongLength);

            uploadResponse.Succeeded.Should().BeFalse();
            uploadResponse.Messages.Should().Contain(message => message.Code == "contentType");

            unitOfWork.AttachmentRepository.NoTrackable()
                .Any(a => a.IncomeId == income.Id)
                .Should().BeFalse();
        }

        [Fact]
        public async Task UploadIncomeAttachment_ExceedingMaxSize_ShouldRejectWithoutStoring()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();

            await using var stream = new MemoryStream(new byte[] { 1 });
            var uploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: stream,
                fileName: "huge.pdf",
                contentType: "application/pdf",
                size: AttachmentUploadPolicy.MaxAttachmentSizeBytes + 1);

            uploadResponse.Succeeded.Should().BeFalse();
            uploadResponse.Messages.Should().Contain(message => message.Code == "size");

            unitOfWork.AttachmentRepository.NoTrackable()
                .Any(a => a.IncomeId == income.Id)
                .Should().BeFalse();
        }

        [Fact]
        public async Task CreateIncome_WithUnknownTemporaryAttachmentId_ShouldNotPersistIncome()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var incomeService = scopedServices.GetRequiredService<IIncomeService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var createResponse = await incomeService.CreateAsync(
                this.user1,
                this.project1.Id,
                new IncomeRequestDTO
                {
                    Name = "Income that must not survive",
                    Date = SystemClock.TodayDate,
                    Amount = 100,
                    TemporaryAttachmentIds = new List<Guid> { Guid.NewGuid() }
                });

            createResponse.Succeeded.Should().BeFalse();
            createResponse.Messages.Should().Contain(message => message.Description == ValidationMessages.TemporaryAttachmentNotFoundOrInvalid);

            unitOfWork.IncomeRepository.NoTrackable()
                .Any(income => income.Name == "Income that must not survive")
                .Should().BeFalse();
        }

        [Fact]
        public async Task UpdateIncome_WithUnknownTemporaryAttachmentId_ShouldNotApplyThePatch()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var incomeService = scopedServices.GetRequiredService<IIncomeService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();
            var originalName = income.Name;

            var patch = new JsonPatchDocument<IncomeRequestDTO>();
            patch.Replace(request => request.Name, "Renamed by a patch that must fail");
            patch.Replace(request => request.TemporaryAttachmentIds, new List<Guid> { Guid.NewGuid() });

            var updateResponse = await incomeService.UpdateAsync(this.user1, this.project1.Id, income.Id, patch);

            updateResponse.Succeeded.Should().BeFalse();

            unitOfWork.IncomeRepository.NoTrackable()
                .First(i => i.Id == income.Id)
                .Name.Should().Be(originalName);
        }

        [Fact]
        public async Task CreateIncome_WithTemporaryAttachmentIds_ShouldLinkAttachmentsToIncome()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var incomeService = scopedServices.GetRequiredService<IIncomeService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var payload = AttachmentTestFiles.Pdf;

            await using var uploadStream = new MemoryStream(payload);
            var temporaryUploadResponse = await attachmentService.UploadTemporaryAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                content: uploadStream,
                fileName: "salary-slip.pdf",
                contentType: "application/pdf",
                size: payload.LongLength,
                attachmentType: AttachmentType.General);

            temporaryUploadResponse.Succeeded.Should().BeTrue();

            var createResponse = await incomeService.CreateAsync(
                this.user1,
                this.project1.Id,
                new IncomeRequestDTO
                {
                    Name = "Salary",
                    Date = SystemClock.TodayDate,
                    Amount = 2500,
                    TemporaryAttachmentIds = new List<Guid> { temporaryUploadResponse.Data.Id }
                });

            createResponse.Succeeded.Should().BeTrue();
            createResponse.Data.Attachments.Should().HaveCount(1);
            createResponse.Data.Attachments.Single().Id.Should().Be(temporaryUploadResponse.Data.Id);
            createResponse.Data.Attachments.Single().IsTemporary.Should().BeFalse();

            var savedAttachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == temporaryUploadResponse.Data.Id);
            savedAttachment.IncomeId.Should().Be(createResponse.Data.Id);
            savedAttachment.IsTemporary.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateIncome_WithTemporaryAttachmentIds_ShouldLinkAttachmentsToIncome()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var incomeService = scopedServices.GetRequiredService<IIncomeService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();
            var payload = AttachmentTestFiles.Pdf;

            await using var uploadStream = new MemoryStream(payload);
            var temporaryUploadResponse = await attachmentService.UploadTemporaryAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                content: uploadStream,
                fileName: "bonus-slip.pdf",
                contentType: "application/pdf",
                size: payload.LongLength,
                attachmentType: AttachmentType.General);

            temporaryUploadResponse.Succeeded.Should().BeTrue();

            var patch = new JsonPatchDocument<IncomeRequestDTO>();
            patch.Replace(request => request.TemporaryAttachmentIds, new List<Guid> { temporaryUploadResponse.Data.Id });

            var updateResponse = await incomeService.UpdateAsync(this.user1, this.project1.Id, income.Id, patch);

            updateResponse.Succeeded.Should().BeTrue();
            updateResponse.Data.Attachments.Should().HaveCount(1);
            updateResponse.Data.Attachments.Single().Id.Should().Be(temporaryUploadResponse.Data.Id);

            var savedAttachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == temporaryUploadResponse.Data.Id);
            savedAttachment.IncomeId.Should().Be(income.Id);
            savedAttachment.IsTemporary.Should().BeFalse();
        }

        [Fact]
        public async Task GetIncome_ShouldIncludeAttachments()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var incomeService = scopedServices.GetRequiredService<IIncomeService>();

            var income = this.project1.Incomes.First();

            await using var stream = new MemoryStream(AttachmentTestFiles.Pdf);
            var uploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: stream,
                fileName: "payslip.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Pdf.LongLength);

            uploadResponse.Succeeded.Should().BeTrue();

            var getResponse = incomeService.Get(
                this.project1.Id,
                SystemClock.TodayDate.AddDays(-10),
                SystemClock.TodayDate.AddDays(1));

            getResponse.Succeeded.Should().BeTrue();
            getResponse.Data.Single(i => i.Id == income.Id).Attachments.Should().HaveCount(1);
            getResponse.Data.Single(i => i.Id == income.Id).Attachments.Single().Name.Should().Be("payslip.pdf");
        }

        [Theory]
        [InlineData("application/pdf")]
        [InlineData("image/png")]
        [InlineData("image/jpeg")]
        [InlineData("image/webp")]
        [InlineData("image/heic")]
        [InlineData("image/heif")]
        public async Task UploadIncomeAttachment_WithEachAllowedType_ShouldStoreThatType(string contentType)
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();
            var payload = PayloadFor(contentType);

            await using var stream = new MemoryStream(payload);
            var uploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: stream,
                fileName: "attachment.bin",
                contentType: contentType,
                size: payload.LongLength);

            uploadResponse.Succeeded.Should().BeTrue("the content is a real file of the declared type");
            uploadResponse.Data.ContentType.Should().Be(contentType);
        }

        [Fact]
        public async Task UploadExpenseAttachment_WithEachAllowedType_ShouldStoreThatType()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var category = this.project1.Categories.First();
            var expense = category.Expenses.First();

            foreach (var (contentType, payload) in new[]
                     {
                         ("image/png", AttachmentTestFiles.Png),
                         ("image/jpeg", AttachmentTestFiles.Jpeg),
                         ("image/webp", AttachmentTestFiles.Webp),
                         ("image/heic", AttachmentTestFiles.Heic),
                         ("image/heif", AttachmentTestFiles.Heif),
                     })
            {
                await using var stream = new MemoryStream(payload);
                var uploadResponse = await attachmentService.UploadExpenseAttachmentAsync(
                    user: this.user1,
                    projectId: this.project1.Id,
                    categoryId: category.Id,
                    expenseId: expense.Id,
                    content: stream,
                    fileName: $"receipt-{contentType.Replace('/', '-')}",
                    contentType: contentType,
                    size: payload.LongLength,
                    attachmentType: AttachmentType.General);

                uploadResponse.Succeeded.Should().BeTrue($"{contentType} is an allowed type");
                uploadResponse.Data.ContentType.Should().Be(contentType);

                unitOfWork.AttachmentRepository.NoTrackable()
                    .First(a => a.Id == uploadResponse.Data.Id)
                    .ContentType.Should().Be(contentType);
            }
        }

        [Fact]
        public async Task UploadExpenseAttachment_WithJpgAlias_ShouldStoreJpeg()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var category = this.project1.Categories.First();
            var expense = category.Expenses.First();

            await using var stream = new MemoryStream(AttachmentTestFiles.Jpeg);
            var uploadResponse = await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                content: stream,
                fileName: "receipt.jpg",
                contentType: "image/jpg",
                size: AttachmentTestFiles.Jpeg.LongLength,
                attachmentType: AttachmentType.General);

            uploadResponse.Succeeded.Should().BeTrue();
            uploadResponse.Data.ContentType.Should().Be("image/jpeg");
        }

        [Fact]
        public async Task UploadExpenseAttachment_WithDisguisedExecutableDeclaredAsPdf_ShouldRejectWithoutStoringOrReplacingTheProof()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var category = this.project1.Categories.First();
            var expense = category.Expenses.First();

            await using var proofStream = new MemoryStream(AttachmentTestFiles.Pdf);
            var existingProof = await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                content: proofStream,
                fileName: "real-proof.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Pdf.LongLength,
                attachmentType: AttachmentType.DeductibleProof);

            existingProof.Succeeded.Should().BeTrue();

            await using var stream = new MemoryStream(AttachmentTestFiles.WindowsExecutable);
            var uploadResponse = await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                content: stream,
                fileName: "invoice.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.WindowsExecutable.LongLength,
                attachmentType: AttachmentType.DeductibleProof);

            uploadResponse.Succeeded.Should().BeFalse();
            uploadResponse.Messages.Should().Contain(
                message => message.Code == "contentType"
                    && message.Description == ValidationMessages.AttachmentContentNotRecognized);

            // The rejected file must not replace the proof that is already there.
            var proofs = unitOfWork.AttachmentRepository.NoTrackable()
                .Where(a => a.ExpenseId == expense.Id && a.AttachmentType == AttachmentType.DeductibleProof)
                .ToList();

            proofs.Should().HaveCount(1);
            proofs.Single().Id.Should().Be(existingProof.Data.Id);
        }

        [Fact]
        public async Task UploadIncomeAttachment_WithDisguisedExecutableDeclaredAsImage_ShouldRejectWithoutStoring()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();

            await using var stream = new MemoryStream(AttachmentTestFiles.ElfExecutable);
            var uploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: stream,
                fileName: "payslip.png",
                contentType: "image/png",
                size: AttachmentTestFiles.ElfExecutable.LongLength);

            uploadResponse.Succeeded.Should().BeFalse();
            uploadResponse.Messages.Should().Contain(
                message => message.Code == "contentType"
                    && message.Description == ValidationMessages.AttachmentContentNotRecognized);

            unitOfWork.AttachmentRepository.NoTrackable()
                .Any(a => a.IncomeId == income.Id)
                .Should().BeFalse();
        }

        [Fact]
        public async Task UploadTemporaryAttachment_WithTruncatedFileDeclaredAsPdf_ShouldRejectWithoutStoring()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            await using var stream = new MemoryStream(AttachmentTestFiles.TruncatedPdf);
            var uploadResponse = await attachmentService.UploadTemporaryAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                content: stream,
                fileName: "half-upload.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.TruncatedPdf.LongLength,
                attachmentType: AttachmentType.General);

            uploadResponse.Succeeded.Should().BeFalse();
            uploadResponse.Messages.Should().Contain(message => message.Code == "contentType");

            unitOfWork.AttachmentRepository.NoTrackable()
                .Any(a => a.IsTemporary)
                .Should().BeFalse();
        }

        [Fact]
        public async Task UploadIncomeAttachment_WithContentThatDoesNotMatchTheDeclaredType_ShouldRejectWithAMismatch()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();

            await using var stream = new MemoryStream(AttachmentTestFiles.Png);
            var uploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: stream,
                fileName: "receipt.pdf",
                contentType: "application/pdf",
                size: AttachmentTestFiles.Png.LongLength);

            uploadResponse.Succeeded.Should().BeFalse();
            uploadResponse.Messages.Should().Contain(
                message => message.Code == "contentType"
                    && message.Description == string.Format(
                        ValidationMessages.AttachmentContentTypeMismatch,
                        "image/png",
                        "application/pdf"));

            unitOfWork.AttachmentRepository.NoTrackable()
                .Any(a => a.IncomeId == income.Id)
                .Should().BeFalse();
        }

        [Fact]
        public async Task UploadIncomeAttachment_FromANonSeekableStream_ShouldStoreTheCompleteFile()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var income = this.project1.Incomes.First();
            var payload = AttachmentTestFiles.Pdf;

            await using var stream = AttachmentTestFiles.NonSeekable(payload);
            var uploadResponse = await attachmentService.UploadIncomeAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                incomeId: income.Id,
                content: stream,
                fileName: "chunked-upload.pdf",
                contentType: "application/pdf",
                size: payload.LongLength);

            uploadResponse.Succeeded.Should().BeTrue();

            var savedAttachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == uploadResponse.Data.Id);
            var storedBytes = this.AttachmentStorage.Read(TestAttachmentBucket, savedAttachment.StorageKey);
            storedBytes.Should().Equal(payload);
        }

        private bool ExistsInStorage(string storageKey) => this.AttachmentStorage.Exists(TestAttachmentBucket, storageKey);

        private static byte[] PayloadFor(string contentType) => contentType switch
        {
            "application/pdf" => AttachmentTestFiles.Pdf,
            "image/png" => AttachmentTestFiles.Png,
            "image/jpeg" => AttachmentTestFiles.Jpeg,
            "image/webp" => AttachmentTestFiles.Webp,
            "image/heic" => AttachmentTestFiles.Heic,
            "image/heif" => AttachmentTestFiles.Heif,
            _ => throw new ArgumentOutOfRangeException(nameof(contentType), contentType, "No payload registered.")
        };
    }
}
