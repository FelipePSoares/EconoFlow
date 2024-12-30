export class User {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  preferredCurrency!: string;
  enabled!: boolean;
  isFirstLogin!: boolean;
  emailConfirmed!: boolean;
  twoFactorEnabled!: boolean;
}

export class DeleteUser {
  confirmationToken!: string;
  confirmationMessage!: string;
}
