import { toDateOnlyString } from 'src/app/core/utils/date';
import { IncomeDto } from './income-dto';

export class IncomePatchModel {
  id?: string;
  name!: string;
  date!: string;
  amount!: number;

  static fromIncome(income: IncomeDto): IncomePatchModel {
    const model = new IncomePatchModel();
    model.id = income.id;
    model.name = income.name ?? '';
    model.date = toDateOnlyString(income.date);
    model.amount = income.amount ?? 0;
    return model;
  }
}
