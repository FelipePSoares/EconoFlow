import { AutoMap } from "@automapper/classes";
import { ExpenseDto } from "../../expense/models/expense-dto";
import { CategoryStatus } from "../../../core/enums/categoryStatus";

export class CategoryDto {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap(() => [ExpenseDto])
  expenses!: ExpenseDto[];

  hasBudget(): boolean { return this.getStatus() != CategoryStatus.NotDefined; }
  hasOverspend(): boolean { return this.getStatus() == CategoryStatus.Exceeded; }
  hasRisk(): boolean { return this.getStatus() == CategoryStatus.Risk; }

  public getStatus(): CategoryStatus {
    let percentage = this.getPercentageSpend();

    if (percentage == undefined) {
      return CategoryStatus.NotDefined;
    }

    return percentage < 75 ? CategoryStatus.Normal : percentage <= 100 ? CategoryStatus.Risk : CategoryStatus.Exceeded;
  }

  public getTotalSpend(): number {
    return (this.expenses?.reduce((sum, current) => sum + current.getSpend(), 0) ?? 0);
  }

  public getTotalBudget(): number {
    return this.expenses?.reduce((sum, current) => sum + current.budget, 0) ?? 0;
  }

  public getTotalOverspend(): number {
    return this.expenses?.reduce((sum, current) => sum + current.getOverspend(), 0) ?? 0;
  }

  public getTotalRemaining(): number {
    return this.expenses?.reduce((sum, current) => sum + current.getRemaining(), 0) ?? 0;
  }

  public getPercentageSpend(): number | undefined {
    return this.getTotalBudget() == 0 ? undefined : (this.getTotalSpend() + this.getTotalOverspend()) * 100 / this.getTotalBudget();
  }
}
