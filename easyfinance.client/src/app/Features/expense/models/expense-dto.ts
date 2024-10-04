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

  public getTotalAmount(): number {
    if (this.items?.length > 0) {
      return this.items.reduce((sum, current) => sum + current.getTotalAmount(), 0);
    }

    return this.amount;
  }
}
