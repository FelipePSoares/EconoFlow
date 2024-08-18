import { AutoMap } from "@automapper/classes";

export class ExpenseItem {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap()
  date!: Date;
  @AutoMap()
  amount!: number;
  @AutoMap(() => [ExpenseItem])
  items!: ExpenseItem[];
}
