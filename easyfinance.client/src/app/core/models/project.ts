import { AutoMap } from "@automapper/classes";
import { ProjectTypes } from "../enums/project-types";

export class Project {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap()
  preferredCurrency!: string;
  @AutoMap()
  type!: ProjectTypes;
}
