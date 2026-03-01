import { ExpenseAttachment } from "./expense-attachment";

export class ExpenseItem {
  id!: string;
  name!: string;
  date!: Date;
  amount!: number;
  isDeductible!: boolean;
  attachments!: ExpenseAttachment[];
  temporaryAttachmentIds!: string[];
  items!: ExpenseItem[];
}
