import { AutoMap } from "@automapper/classes";
import { ProjectType } from "src/app/core/enums/project-type";

export class ProjectDto {
    @AutoMap()
    id!: string;
    @AutoMap()
    name!: string;
    @AutoMap()
    type!: ProjectType;
  }