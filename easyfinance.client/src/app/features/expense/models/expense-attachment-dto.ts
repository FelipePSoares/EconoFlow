import { ExpenseAttachment } from "src/app/core/models/expense-attachment";

export class ExpenseAttachmentDto {
  id!: string;
  name!: string;
  contentType!: string;
  size!: number;
  attachmentType!: number;
  isTemporary!: boolean;

  static fromExpenseAttachment(attachment: ExpenseAttachment): ExpenseAttachmentDto {
    const dto = new ExpenseAttachmentDto();
    dto.id = attachment.id;
    dto.name = attachment.name;
    dto.contentType = attachment.contentType;
    dto.size = attachment.size;
    dto.attachmentType = attachment.attachmentType;
    dto.isTemporary = attachment.isTemporary;
    return dto;
  }
}
