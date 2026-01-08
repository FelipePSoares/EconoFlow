import { Project } from "src/app/core/models/project";

export class ProjectDto {
  id!: string;
  name!: string;
  preferredCurrency!: string;

  static fromProject(project: Project): ProjectDto {
    const dto = new ProjectDto();
    dto.id = project.id;
    dto.name = project.name;
    dto.preferredCurrency = project.preferredCurrency;
    return dto;
  }

  static fromProjects(projects: Project[]): ProjectDto[] {
    return projects.map(project => ProjectDto.fromProject(project));
  }
}