import { AutoMap } from "@automapper/classes";
import { NotificationType } from "../enums/notification-type";
import { NotificationCategory } from "../enums/notification-category";

export class Notification {
  @AutoMap()
  id!: string;
  @AutoMap()
  CodeMessage!: string;
  @AutoMap()
  ActionLabelCode!: string;
  @AutoMap()
  type!: NotificationType;
  @AutoMap()
  category!: NotificationCategory;
  @AutoMap()
  isActionRequired!: boolean;
  @AutoMap()
  IsSticky!: boolean;
  @AutoMap()
  Metadata!: string;
}
