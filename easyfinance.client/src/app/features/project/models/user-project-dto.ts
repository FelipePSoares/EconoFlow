import { AutoMap } from "@automapper/classes";
import { Role } from "../../../core/enums/Role";

export class UserProjectDto {
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
