import { AutoMap } from "@automapper/classes";
import { ExpenseItemDto } from "./expense-item-dto";

export class ExpenseDto {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap()
  date!: Date;
  @AutoMap()
  amount!: number;
  @AutoMap()
  budget!: number;
  @AutoMap(() => [ExpenseItemDto])
  items!: ExpenseItemDto[];

  public getSpend(): number {
    return this.amount - this.getOverspend();
  }

  public getOverspend(): number {
    const overspend = this.amount - this.budget;
    return overspend > 0 ? overspend : 0;
  }

  public getRemaining(): number {
    return this.budget - this.getSpend();
  }
}
