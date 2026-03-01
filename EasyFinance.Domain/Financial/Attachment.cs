using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Shared;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Infrastructure.Extensions;
using System;
using System.Linq;

namespace EasyFinance.Domain.Financial
{
    public class Attachment : BaseEntity
    {
        private const int contentTypeMaxLength = 200;
        private const int storageKeyMaxLength = 512;
        private Attachment() { }

        public Attachment(
            string name = "default",
            string contentType = "application/octet-stream",
            long size = 1,
            string storageKey = "storage-key",
            AttachmentType attachmentType = AttachmentType.General,
            bool isTemporary = false,
            Guid? expenseId = null,
            Guid? expenseItemId = null,
            Guid? incomeId = null,
            User createdBy = default)
        {
            SetExpenseId(expenseId);
            SetExpenseItemId(expenseItemId);
            SetIncomeId(incomeId);
            SetName(name);
            SetContentType(contentType);
            SetSize(size);
            SetStorageKey(storageKey);
            SetAttachmentType(attachmentType);
            SetIsTemporary(isTemporary);
            SetCreatedBy(createdBy ?? new User());
        }

        public Guid? ExpenseId { get; private set; }
        public Guid? ExpenseItemId { get; private set; }
        public Guid? IncomeId { get; private set; }
        public string Name { get; private set; } = string.Empty;
        public string ContentType { get; private set; } = string.Empty;
        public long Size { get; private set; } = 0;
        public string StorageKey { get; private set; } = string.Empty;
        public AttachmentType AttachmentType { get; private set; } = AttachmentType.General;
        public bool IsTemporary { get; private set; }
        public User CreatedBy { get; private set; } = new User();

        public override AppResponse Validate {
            get
            {
                var response = AppResponse.Success();

                if (string.IsNullOrEmpty(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));
                
                if (!string.IsNullOrEmpty(Name) && Name.Length > PropertyMaxLengths.GetMaxLength(PropertyType.AttachmentName))
                    response.AddErrorMessage(nameof(Name),
                        string.Format(ValidationMessages.PropertyMaxLength,
                        nameof(Name),
                        PropertyMaxLengths.GetMaxLength(PropertyType.AttachmentName)));

                var linkedEntitiesCount = new[]
                {
                    ExpenseId.HasValue && ExpenseId.Value != Guid.Empty,
                    ExpenseItemId.HasValue && ExpenseItemId.Value != Guid.Empty,
                    IncomeId.HasValue && IncomeId.Value != Guid.Empty
                }.Count(isLinked => isLinked);

                if (IsTemporary)
                {
                    if (linkedEntitiesCount > 0)
                        response.AddErrorMessage("ParentId", ValidationMessages.TemporaryAttachmentCannotHaveParent);
                }
                else
                {
                    if (linkedEntitiesCount == 0)
                        response.AddErrorMessage("ParentId", ValidationMessages.AttachmentParentRequired);

                    if (linkedEntitiesCount > 1)
                        response.AddErrorMessage("ParentId", ValidationMessages.AttachmentSingleParentRequired);
                }

                if (string.IsNullOrWhiteSpace(ContentType))
                    response.AddErrorMessage(nameof(ContentType), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(ContentType)));
                else if (ContentType.Length > contentTypeMaxLength)
                    response.AddErrorMessage(nameof(ContentType), string.Format(ValidationMessages.PropertyMaxLength, nameof(ContentType), contentTypeMaxLength));

                if (Size <= 0)
                    response.AddErrorMessage(nameof(Size), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(Size)));

                if (string.IsNullOrWhiteSpace(StorageKey))
                    response.AddErrorMessage(nameof(StorageKey), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(StorageKey)));
                else if (StorageKey.Length > storageKeyMaxLength)
                    response.AddErrorMessage(nameof(StorageKey), string.Format(ValidationMessages.PropertyMaxLength, nameof(StorageKey), storageKeyMaxLength));

                var userValidation = CreatedBy.Validate;
                if (userValidation.Failed)
                    response.AddErrorMessage(userValidation.Messages.AddPrefix(nameof(CreatedBy)));

                return response;
            }
        }

        public void SetExpenseId(Guid? expenseId)
        {
            ExpenseId = expenseId;
        }

        public void SetExpenseItemId(Guid? expenseItemId)
        {
            ExpenseItemId = expenseItemId;
        }

        public void SetIncomeId(Guid? incomeId)
        {
            IncomeId = incomeId;
        }

        public void SetName(string name)
        {
            Name = name;
        }

        public void SetContentType(string contentType)
        {
            ContentType = contentType?.Trim() ?? string.Empty;
        }

        public void SetSize(long size)
        {
            Size = size;
        }

        public void SetStorageKey(string storageKey)
        {
            StorageKey = storageKey?.Trim() ?? string.Empty;
        }

        public void SetAttachmentType(AttachmentType attachmentType)
        {
            AttachmentType = attachmentType;
        }

        public void SetIsTemporary(bool isTemporary)
        {
            IsTemporary = isTemporary;
        }

        public void SetCreatedBy(User createdBy)
        {
            CreatedBy = createdBy ?? throw new ArgumentNullException(null, string.Format(ValidationMessages.PropertyCantBeNull, nameof(createdBy)));
        }
    }
}
