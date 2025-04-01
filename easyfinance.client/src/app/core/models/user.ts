import { SubscriptionLevel } from "../enums/subscription-level";

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
  subscriptionLevel!: SubscriptionLevel;
}

export class DeleteUser {
  confirmationToken!: string;
  confirmationMessage!: string;
}
