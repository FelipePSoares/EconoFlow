import { AutoMap } from "@automapper/classes";
import { ProjectType } from "../enums/project-type";

export class Project {
  @AutoMap()
  id!: string;
  @AutoMap()
  name!: string;
  @AutoMap()
  type!: ProjectType;
}
