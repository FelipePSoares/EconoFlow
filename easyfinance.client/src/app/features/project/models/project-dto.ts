import { AutoMap } from "@automapper/classes";
import { ProjectTypes } from "../../../core/enums/project-types";

export class ProjectDto {
    @AutoMap()
    id!: string;
    @AutoMap()
    name!: string;
    @AutoMap()
    preferredCurrency!: string;
    @AutoMap()
    type!: ProjectTypes;
  }
