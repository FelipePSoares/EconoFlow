import { AutoMap } from "@automapper/classes";
import { ExpenseDto } from "../../expense/models/expense-dto";

export class CategoryDto {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap()
  goal!: number;
  @AutoMap(() => [ExpenseDto])
  expenses!: ExpenseDto[];
  
  public getTotalWaste(): number {
    return this.expenses.reduce((sum, current) => sum + current.amount, 0);
  }
}
