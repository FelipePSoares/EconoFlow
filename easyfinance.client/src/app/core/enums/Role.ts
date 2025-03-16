export enum Role {
  Viewer = "Viewer",
  Manager = "Manager",
  Admin = "Admin"
}

export const Role2LabelMapping: Record<Role, string> = {
  [Role.Viewer]: "Viewer",
  [Role.Manager]: "Manager",
  [Role.Admin]: "Admin",
};
