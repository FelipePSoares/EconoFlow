import { AutoMap } from "@automapper/classes";

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
  goal!: number;
}
