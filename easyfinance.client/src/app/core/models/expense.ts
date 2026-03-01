import { ExpenseItem } from "./expense-item";
import { ExpenseAttachment } from "./expense-attachment";

export class Expense {
  id!: string;
  name!: string;
  date!: Date;
  amount!: number;
  budget!: number;
  isDeductible!: boolean;
  attachments!: ExpenseAttachment[];
  temporaryAttachmentIds!: string[];
  items!: ExpenseItem[];
}
