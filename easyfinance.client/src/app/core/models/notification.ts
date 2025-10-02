import { AutoMap } from "@automapper/classes";
import { NotificationType } from "../enums/notification-type";
import { NotificationCategory } from "../enums/notification-category";

export class Notification {
  @AutoMap()
  id!: string;
  @AutoMap()
  codeMessage!: string;
  @AutoMap()
  actionLabelCode!: string;
  @AutoMap()
  type!: NotificationType;
  @AutoMap()
  category!: NotificationCategory;
  @AutoMap()
  isActionRequired!: boolean;
  @AutoMap()
  isSticky!: boolean;
  @AutoMap()
  metadata!: string;
}
