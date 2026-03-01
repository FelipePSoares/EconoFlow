import { Expense } from "src/app/core/models/expense";
import { ExpenseItemDto } from "./expense-item-dto";
import { ExpenseAttachmentDto } from "./expense-attachment-dto";
import { toLocalDate } from "src/app/core/utils/date";
import { AttachmentType } from "src/app/core/enums/attachment-type";

export class ExpenseDto {
  id!: string;
  name!: string;
  date!: Date;
  amount!: number;
  budget!: number;
  isDeductible!: boolean;
  attachments!: ExpenseAttachmentDto[];
  temporaryAttachmentIds!: string[];
  items!: ExpenseItemDto[];

  static fromExpense(expense: Expense): ExpenseDto {
    const dto = new ExpenseDto();
    dto.id = expense.id;
    dto.name = expense.name;
    dto.date = toLocalDate(expense.date);
    dto.amount = expense.amount;
    dto.budget = expense.budget;
    dto.isDeductible = expense.isDeductible ?? false;
    dto.attachments = (expense.attachments ?? []).map(attachment => ExpenseAttachmentDto.fromExpenseAttachment(attachment));
    dto.temporaryAttachmentIds = expense.temporaryAttachmentIds ?? [];
    dto.items = (expense.items ?? []).map(expenseItem => ExpenseItemDto.fromExpenseItem(expenseItem));
    return dto;
  }

  static fromExpenses(expenses: Expense[]): ExpenseDto[] {
    return expenses.map(expense => ExpenseDto.fromExpense(expense));
  }

  public getSpend(): number {
    return this.amount - this.getOverspend();
  }

  public getOverspend(): number {
    const overspend = this.amount - this.budget;
    return overspend > 0 ? overspend : 0;
  }

  public getRemaining(): number {
    return this.budget - this.getSpend();
  }

  public getDeductibleProofAttachment(): ExpenseAttachmentDto | null {
    return (this.attachments ?? []).find(attachment => attachment.attachmentType === AttachmentType.DeductibleProof) ?? null;
  }
}
