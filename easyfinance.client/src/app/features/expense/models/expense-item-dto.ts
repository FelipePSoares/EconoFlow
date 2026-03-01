import { ExpenseItem } from "src/app/core/models/expense-item";
import { toLocalDate } from "src/app/core/utils/date";
import { ExpenseAttachmentDto } from "./expense-attachment-dto";
import { AttachmentType } from "src/app/core/enums/attachment-type";

export class ExpenseItemDto {
  id!: string;
  name!: string;
  date!: Date;
  amount!: number;
  isDeductible!: boolean;
  attachments!: ExpenseAttachmentDto[];
  temporaryAttachmentIds!: string[];
  items!: ExpenseItemDto[];

  static fromExpenseItem(expenseItem: ExpenseItem): ExpenseItemDto {
    const dto = new ExpenseItemDto();
    dto.id = expenseItem.id;
    dto.name = expenseItem.name;
    dto.date = toLocalDate(expenseItem.date);
    dto.amount = expenseItem.amount;
    dto.isDeductible = expenseItem.isDeductible ?? false;
    dto.attachments = (expenseItem.attachments ?? []).map(attachment => ExpenseAttachmentDto.fromExpenseAttachment(attachment));
    dto.temporaryAttachmentIds = expenseItem.temporaryAttachmentIds ?? [];
    dto.items = (expenseItem.items ?? []).map(ei => ExpenseItemDto.fromExpenseItem(ei));
    return dto;
  }

  static fromExpenses(expenseItems: ExpenseItem[]): ExpenseItemDto[] {
    return expenseItems.map(expenseItem => ExpenseItemDto.fromExpenseItem(expenseItem));
  }

  public getTotalAmount(): number {
    if (this.items?.length > 0) {
      return this.items.reduce((sum, current) => sum + current.getTotalAmount(), 0);
    }

    return this.amount;
  }

  public getDeductibleProofAttachment(): ExpenseAttachmentDto | null {
    return (this.attachments ?? []).find(attachment => attachment.attachmentType === AttachmentType.DeductibleProof) ?? null;
  }
}
