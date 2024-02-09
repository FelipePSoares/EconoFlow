export enum ProjectType {
    Personal = "personal",
    Company = "company"
}

export const ProjectType2LabelMapping: Record<ProjectType, string> = {
    [ProjectType.Personal]: "Personal",
    [ProjectType.Company]: "Company",
};