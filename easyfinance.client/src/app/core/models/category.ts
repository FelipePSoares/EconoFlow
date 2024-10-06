import { AutoMap } from "@automapper/classes";
import { Expense } from "./expense";

export class Category {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap(() => [Expense])
  expenses!: Expense[];
}
