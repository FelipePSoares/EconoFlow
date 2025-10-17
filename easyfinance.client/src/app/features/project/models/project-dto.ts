import { AutoMap } from "@automapper/classes";

export class ProjectDto {
    @AutoMap()
    id!: string;
    @AutoMap()
    name!: string;
    @AutoMap()
    preferredCurrency!: string;
  }
