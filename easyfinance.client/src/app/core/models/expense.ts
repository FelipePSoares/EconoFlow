import { ExpenseItem } from "./expense-item";
import { Attachment } from "./attachment";

export class Expense {
  id!: string;
  name!: string;
  date!: Date;
  amount!: number;
  budget!: number;
  isDeductible!: boolean;
  attachments!: Attachment[];
  temporaryAttachmentIds!: string[];
  items!: ExpenseItem[];
}
