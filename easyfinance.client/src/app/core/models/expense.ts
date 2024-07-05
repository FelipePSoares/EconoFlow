import { AutoMap } from "@automapper/classes";

export class Expense {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap()
  date!: Date;
  @AutoMap()
  amount!: number;
  @AutoMap()
  goal!: number;
}
