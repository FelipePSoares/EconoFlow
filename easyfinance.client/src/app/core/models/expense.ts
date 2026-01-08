import { ExpenseItem } from "./expense-item";

export class Expense {
  id!: string;
  name!: string;
  date!: Date;
  amount!: number;
  budget!: number;
  items!: ExpenseItem[];
}
