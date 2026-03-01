import { AttachmentType } from "../enums/attachment-type";

export class ExpenseAttachment {
  id!: string;
  name!: string;
  contentType!: string;
  size!: number;
  attachmentType!: AttachmentType;
  isTemporary!: boolean;
}
