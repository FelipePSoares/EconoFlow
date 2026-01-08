import { Role } from "../enums/Role";
import { Project } from "./project";

export class UserProject {
  id!: string;
  userId!: string;
  project!: Project;
  userName!: string;
  userEmail!: string;
  role!: Role;
  accepted!: boolean;
}
