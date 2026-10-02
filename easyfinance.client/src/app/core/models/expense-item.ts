import { Attachment } from "./attachment";

export class ExpenseItem {
  id!: string;
  name!: string;
  date!: Date;
  amount!: number;
  isDeductible!: boolean;
  attachments!: Attachment[];
  temporaryAttachmentIds!: string[];
  items!: ExpenseItem[];
}
