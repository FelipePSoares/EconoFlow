import { WebPushDeviceType } from '../enums/web-push-device-type';

export interface WebPushSubscriptionRequest {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  deviceType: WebPushDeviceType;
  permissionStatus: NotificationPermission;
}
