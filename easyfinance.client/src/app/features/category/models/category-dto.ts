import { AutoMap } from "@automapper/classes";
import { ExpenseDto } from "../../expense/models/expense-dto";

export class CategoryDto {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap(() => [ExpenseDto])
  expenses!: ExpenseDto[];


  public getTotalWaste(): number {
    return this.expenses.reduce((sum, current) => sum + current.amount, 0);
  }

  public getTotalBudget(): number {
    return this.expenses.reduce((sum, current) => sum + current.budget, 0);
  }

  public getTotalRemaining(): number {
    return this.getTotalBudget() - this.getTotalWaste();
  }

  public getPercentageWaste(): number {
    return this.getTotalWaste() * 100 / this.getTotalBudget();
  }
}
