import { AutoMap } from "@automapper/classes";
import { ExpenseDto } from "../../expense/models/expense-dto";

export class CategoryDto {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap(() => [ExpenseDto])
  expenses!: ExpenseDto[];


  public getTotalSpend(): number {
    return this.expenses.reduce((sum, current) => sum + current.amount, 0) - this.getTotalOverspend();
  }

  public getTotalBudget(): number {
    return this.expenses.reduce((sum, current) => sum + current.budget, 0);
  }

  public getTotalOverspend(): number {
    return this.expenses.map(e => {
      let overspend = e.budget - e.amount;
      return overspend < 0 ? overspend * -1 : 0;
    }).reduce((sum, current) => sum + current, 0);
  }

  public getTotalRemaining(): number {
    return this.getTotalBudget() - this.getTotalSpend();
  }

  public getPercentageSpend(): number {
    return this.getTotalSpend() * 100 / this.getTotalBudget();
  }
}
