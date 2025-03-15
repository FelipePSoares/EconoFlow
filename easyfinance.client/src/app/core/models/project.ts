import { AutoMap } from "@automapper/classes";

export class Project {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap()
  preferredCurrency!: string;
}
