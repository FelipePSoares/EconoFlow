using System;
using System.IO;
using System.Linq;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Domain.Financial;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class AttachmentServiceTests : EasyFinance.Common.Tests.BaseTests, IDisposable
    {
        private const string AttachmentRootPathEnvironmentVariable = "EconoFlow_ATTACHMENTS_ROOT_PATH";
        private readonly string attachmentsRootPath;
        private readonly string? previousAttachmentRootPath;

        public AttachmentServiceTests()
        {
            this.previousAttachmentRootPath = Environment.GetEnvironmentVariable(AttachmentRootPathEnvironmentVariable);
            this.attachmentsRootPath = Path.Combine(Path.GetTempPath(), $"econoflow-attachments-{Guid.NewGuid():N}");
            Environment.SetEnvironmentVariable(AttachmentRootPathEnvironmentVariable, this.attachmentsRootPath);

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
            var payload = new byte[] { 1, 2, 3, 4 };

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
            File.Exists(ToStoragePath(savedAttachment.StorageKey)).Should().BeTrue();
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
            var payload = new byte[] { 4, 3, 2, 1 };

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
            File.Exists(ToStoragePath(savedAttachment.StorageKey)).Should().BeTrue();
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
            var payload = new byte[] { 8, 7, 6, 5 };

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

            await using var firstStream = new MemoryStream(new byte[] { 1, 1, 1 });
            var firstUploadResponse = await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                content: firstStream,
                fileName: "proof-1.pdf",
                contentType: "application/pdf",
                size: 3,
                attachmentType: AttachmentType.DeductibleProof);

            firstUploadResponse.Succeeded.Should().BeTrue();
            var firstAttachmentStorageKey = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == firstUploadResponse.Data.Id).StorageKey;

            await using var secondStream = new MemoryStream(new byte[] { 2, 2, 2, 2 });
            var secondUploadResponse = await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                content: secondStream,
                fileName: "proof-2.pdf",
                contentType: "application/pdf",
                size: 4,
                attachmentType: AttachmentType.DeductibleProof);

            secondUploadResponse.Succeeded.Should().BeTrue();

            var deductibleProofs = unitOfWork.AttachmentRepository.NoTrackable()
                .Where(a => a.ExpenseId == expense.Id && a.AttachmentType == AttachmentType.DeductibleProof)
                .ToList();

            deductibleProofs.Should().HaveCount(1);
            deductibleProofs.Single().Id.Should().Be(secondUploadResponse.Data.Id);
            File.Exists(ToStoragePath(firstAttachmentStorageKey)).Should().BeFalse();
            File.Exists(ToStoragePath(deductibleProofs.Single().StorageKey)).Should().BeTrue();
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

            await using var stream = new MemoryStream(new byte[] { 9, 9, 9 });
            var uploadResponse = await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: category.Id,
                expenseId: expense.Id,
                content: stream,
                fileName: "delete-me.pdf",
                contentType: "application/pdf",
                size: 3,
                attachmentType: AttachmentType.General);

            uploadResponse.Succeeded.Should().BeTrue();
            var attachment = unitOfWork.AttachmentRepository.NoTrackable().First(a => a.Id == uploadResponse.Data.Id);
            var storagePath = ToStoragePath(attachment.StorageKey);
            File.Exists(storagePath).Should().BeTrue();

            var deleteResponse = await attachmentService.DeleteExpenseAttachmentAsync(this.project1.Id, category.Id, expense.Id, attachment.Id);
            deleteResponse.Succeeded.Should().BeTrue();

            unitOfWork.AttachmentRepository.NoTrackable().Any(a => a.Id == attachment.Id).Should().BeFalse();
            File.Exists(storagePath).Should().BeFalse();
        }

        [Fact]
        public async Task UploadAttachment_WithMismatchedProjectCategory_ShouldThrowNotFound()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var attachmentService = scopedServices.GetRequiredService<IAttachmentService>();

            var foreignCategory = this.project2.Categories.First();
            var foreignExpense = foreignCategory.Expenses.First();

            await using var stream = new MemoryStream(new byte[] { 5, 5, 5 });
            var action = async () => await attachmentService.UploadExpenseAttachmentAsync(
                user: this.user1,
                projectId: this.project1.Id,
                categoryId: foreignCategory.Id,
                expenseId: foreignExpense.Id,
                content: stream,
                fileName: "not-allowed.pdf",
                contentType: "application/pdf",
                size: 3,
                attachmentType: AttachmentType.General);

            await action.Should().ThrowAsync<KeyNotFoundException>();
        }

        private string ToStoragePath(string storageKey)
            => Path.Combine(this.attachmentsRootPath, storageKey.Replace('/', Path.DirectorySeparatorChar));

        public new void Dispose()
        {
            base.Dispose();

            Environment.SetEnvironmentVariable(AttachmentRootPathEnvironmentVariable, this.previousAttachmentRootPath);
            if (Directory.Exists(this.attachmentsRootPath))
                Directory.Delete(this.attachmentsRootPath, recursive: true);
        }
    }
}
