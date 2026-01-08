import { Expense } from "./expense";

export class Category {
  id!: string;
  name!: string;
  expenses!: Expense[];
  isArchived!: boolean;
}
