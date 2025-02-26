import { AutoMap } from "@automapper/classes";
import { Role } from "../enums/Role";

export class UserProject {
  @AutoMap()
  userId!: string;
  @AutoMap()
  userName!: string;
  @AutoMap()
  userEmail!: string;
  @AutoMap()
  role!: Role;
  @AutoMap()
  accepted!: boolean;
}
