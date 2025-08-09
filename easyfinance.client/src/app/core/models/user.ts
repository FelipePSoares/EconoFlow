export class User {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  fullName!: string;
  enabled!: boolean;
  isFirstLogin!: boolean;
  emailConfirmed!: boolean;
  twoFactorEnabled!: boolean;
  defaultProjectId!: string;
}

export class DeleteUser {
  confirmationToken!: string;
  confirmationMessage!: string;
}
