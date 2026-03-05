import { Project } from "src/app/core/models/project";
import { TaxYearLabeling } from "src/app/core/enums/tax-year-labeling";
import { TaxYearType } from "src/app/core/enums/tax-year-type";

export class ProjectDto {
  id!: string;
  name!: string;
  preferredCurrency!: string;
  taxYearType?: TaxYearType | null;
  taxYearStartMonth?: number | null;
  taxYearStartDay?: number | null;
  taxYearLabeling?: TaxYearLabeling | null;

  static fromProject(project: Project): ProjectDto {
    const dto = new ProjectDto();
    dto.id = project.id;
    dto.name = project.name;
    dto.preferredCurrency = project.preferredCurrency;
    dto.taxYearType = project.taxYearType ?? null;
    dto.taxYearStartMonth = project.taxYearStartMonth ?? null;
    dto.taxYearStartDay = project.taxYearStartDay ?? null;
    dto.taxYearLabeling = project.taxYearLabeling ?? null;
    return dto;
  }

  static fromProjects(projects: Project[]): ProjectDto[] {
    return projects.map(project => ProjectDto.fromProject(project));
  }
}
