export enum ProjectTypes {
  Personal = 0,
  Company = 1
}

export const SubscriptionLevel2LabelMapping: Record<ProjectTypes, string> = {
  [ProjectTypes.Personal]: "Personal",
  [ProjectTypes.Company]: "Company",
};


