import { AutoMap } from "@automapper/classes";

export class ExpenseItemDto {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap()
  date!: Date;
  @AutoMap()
  amount!: number;
  @AutoMap(() => [ExpenseItemDto])
  items!: ExpenseItemDto[];

  public getTotalAmount(): number {
    if (this.items?.length > 0) {
      return this.items.reduce((sum, current) => sum + current.getTotalAmount(), 0);
    }

    return this.amount;
  }
}
