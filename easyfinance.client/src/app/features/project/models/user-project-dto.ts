import { UserProject } from "src/app/core/models/user-project";
import { Role } from "../../../core/enums/Role";
import { ProjectDto } from "./project-dto";

export class UserProjectDto {
  id!: string;
  userId!: string;
  project!: ProjectDto;
  userName!: string;
  userEmail!: string;
  role!: Role;
  accepted!: boolean;
  
  static fromUserProject(userProject: UserProject): UserProjectDto {
    const dto = new UserProjectDto();
    dto.id = userProject.id;
    dto.userId = userProject.userId;
    dto.project = ProjectDto.fromProject(userProject.project);
    dto.userName = userProject.userName;
    dto.userEmail = userProject.userEmail;
    dto.role = userProject.role;
    dto.accepted = userProject.accepted;
    return dto;
  }

  static fromUserProjects(userProjects: UserProject[]): UserProjectDto[] {
    return userProjects.map(userProject => UserProjectDto.fromUserProject(userProject));
  }
}
