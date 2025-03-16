import { AutoMap } from "@automapper/classes";
import { Role } from "../../../core/enums/Role";
import { ProjectDto } from "./project-dto";

export class UserProjectDto {
  @AutoMap()
  id!: string;
  @AutoMap()
  userId!: string;
  @AutoMap(() => ProjectDto)
  project!: ProjectDto;
  @AutoMap()
  userName!: string;
  @AutoMap()
  userEmail!: string;
  @AutoMap()
  role!: Role;
  @AutoMap()
  accepted!: boolean;
}
