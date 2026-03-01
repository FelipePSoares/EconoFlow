import { ExpenseAttachment } from "src/app/core/models/expense-attachment";
import { AttachmentType } from "../../../core/enums/attachment-type";

export class ExpenseAttachmentDto {
  id!: string;
  name!: string;
  contentType!: string;
  size!: number;
  attachmentType!: AttachmentType;
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
