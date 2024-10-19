import { AutoMap } from "@automapper/classes";

export class IncomeDto {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap()
  date!: Date;
  @AutoMap()
  amount!: number;
}