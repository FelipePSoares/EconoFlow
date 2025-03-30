import { AutoMap } from "@automapper/classes";

export class DefaultCategory {
  @AutoMap()
  name!: string;
  @AutoMap()
  percentage!: number;
}
