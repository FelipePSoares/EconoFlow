import { ExpenseDto } from './expense-dto';
import { ExpenseItemPatchModel } from './expense-item-patch-model';
import { toDateOnlyString } from 'src/app/core/utils/date';

export class ExpensePatchModel {
  id?: string;
  name!: string;
  date!: string;
  amount!: number;
  budget!: number;
  items!: ExpenseItemPatchModel[];

  static fromExpense(expense: ExpenseDto): ExpensePatchModel {
    const model = new ExpensePatchModel();
    model.id = expense.id;
    model.name = expense.name ?? '';
    model.date = toDateOnlyString(expense.date);
    model.amount = expense.amount ?? 0;
    model.budget = expense.budget ?? 0;
    model.items = (expense.items ?? []).map(item => ExpenseItemPatchModel.fromExpenseItem(item));
    return model;
  }
}
