import { NotificationType } from "../enums/notification-type";
import { NotificationCategory } from "../enums/notification-category";

export class Notification {
  id!: string;
  codeMessage!: string;
  actionLabelCode!: string;
  type!: NotificationType;
  category!: NotificationCategory;
  isActionRequired!: boolean;
  isSticky!: boolean;
  metadata!: string;
}
