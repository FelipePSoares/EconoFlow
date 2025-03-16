import { AutoMap } from "@automapper/classes";
import { Role } from "../enums/Role";
import { Project } from "./project";

export class UserProject {
  @AutoMap()
  id!: string;
  @AutoMap()
  userId!: string;
  @AutoMap(() => Project)
  project!: Project;
  @AutoMap()
  userName!: string;
  @AutoMap()
  userEmail!: string;
  @AutoMap()
  role!: Role;
  @AutoMap()
  accepted!: boolean;
}
