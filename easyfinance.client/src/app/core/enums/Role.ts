export enum Role {
  Viewer = "viewer",
  Manager = "manager",
  Admin = "admin"
}

export const Role2LabelMapping: Record<Role, string> = {
  [Role.Viewer]: "Viewer",
  [Role.Manager]: "Manager",
  [Role.Admin]: "Admin",
};
