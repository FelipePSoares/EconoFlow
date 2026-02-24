import { toDateOnlyString } from 'src/app/core/utils/date';
import { ExpenseItemDto } from './expense-item-dto';

export class ExpenseItemPatchModel {
  id?: string;
  name!: string;
  date!: string;
  amount!: number;
  items!: ExpenseItemPatchModel[];

  static fromExpenseItem(item: ExpenseItemDto): ExpenseItemPatchModel {
    const model = new ExpenseItemPatchModel();
    model.id = item.id;
    model.name = item.name ?? '';
    model.date = toDateOnlyString(item.date);
    model.amount = item.amount ?? 0;
    model.items = (item.items ?? []).map(child => ExpenseItemPatchModel.fromExpenseItem(child));
    return model;
  }
}
