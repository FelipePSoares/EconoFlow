import { ExpenseItem } from "src/app/core/models/expense-item";

export class ExpenseItemDto {
  id!: string;
  name!: string;
  date!: Date;
  amount!: number;
  items!: ExpenseItemDto[];

  static fromExpenseItem(expenseItem: ExpenseItem): ExpenseItemDto {
    const dto = new ExpenseItemDto();
    dto.id = expenseItem.id;
    dto.name = expenseItem.name;
    dto.date = expenseItem.date;
    dto.amount = expenseItem.amount;
    dto.items = expenseItem.items.map(ei => ExpenseItemDto.fromExpenseItem(ei));
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
}
