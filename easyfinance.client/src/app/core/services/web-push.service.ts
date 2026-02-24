import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { WebPushBlockedDialogComponent } from '../components/web-push-blocked-dialog/web-push-blocked-dialog.component';
import { WebPushPermissionDialogComponent } from '../components/web-push-permission-dialog/web-push-permission-dialog.component';
import { WebPushDeviceType } from '../enums/web-push-device-type';
import { WebPushPublicKeyResponse } from '../models/web-push-public-key-response';
import { WebPushSubscriptionRequest } from '../models/web-push-subscription-request';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root',
})
export class WebPushService {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private userService = inject(UserService);
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);

  private readonly permissionStorageKey = 'webPushPermissionStatus';
  private readonly prePromptDismissedStorageKey = 'webPushPrePromptDismissed';
  private readonly browserPromptAttemptedStorageKey = 'webPushBrowserPromptAttempted';

  private initializedForUserId: string | null = null;
  private initializationInProgress = false;
  private vapidPublicKey: string | null = null;

  public async initializeForCurrentUser(): Promise<void> {
    await this.initializeForCurrentUserInternal(false, false);
  }

  public async initializeForCurrentUserFromUserAction(): Promise<void> {
    if (!isPlatformBrowser(this.platformId))
      return;

    this.clearPermissionPromptSkips();
    await this.initializeForCurrentUserInternal(true, true);
  }

  private async initializeForCurrentUserInternal(promptForDeniedPermission: boolean, forceReinitialize: boolean): Promise<void> {
    if (!isPlatformBrowser(this.platformId))
      return;

    if (this.initializationInProgress || !this.isWebPushSupported())
      return;

    this.initializationInProgress = true;

    try {
      const user = await firstValueFrom(this.userService.loggedUser$);
      if (!user?.enabled || !user.id || !user.notificationChannels?.includes('Push'))
        return;

      if (!forceReinitialize && this.initializedForUserId === user.id)
        return;

      const permission = await this.requestPermission(promptForDeniedPermission);
      this.savePermissionStatus(permission);

      if (permission !== 'granted') {
        this.initializedForUserId = user.id;
        return;
      }

      const registration = await navigator.serviceWorker.register('/web-push-sw.js');
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await this.subscribe(registration);

      if (!subscription) {
        this.initializedForUserId = user.id;
        return;
      }

      const payload = this.toRequestPayload(subscription, permission);
      if (!payload) {
        this.initializedForUserId = user.id;
        return;
      }

      await firstValueFrom(this.http.post('/api/Account/WebPush/Subscriptions', payload));

      if (!existingSubscription)
        await firstValueFrom(this.http.post('/api/Account/WebPush/Test', {}));

      this.initializedForUserId = user.id;
    }
    catch
    {
      // Keep this flow silent. Failures here must not block regular app usage.
    }
    finally
    {
      this.initializationInProgress = false;
    }
  }

  public resetState(): void {
    this.initializedForUserId = null;
    this.initializationInProgress = false;
  }

  private async subscribe(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
    const publicKey = await this.getPublicKey();
    if (!publicKey)
      return null;

    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.base64UrlToArrayBuffer(publicKey)
    });
  }

  private async getPublicKey(): Promise<string | null> {
    if (this.vapidPublicKey)
      return this.vapidPublicKey;

    const response = await firstValueFrom(this.http.get<WebPushPublicKeyResponse>('/api/Account/WebPush/PublicKey'));
    const publicKey = response?.publicKey?.trim();

    if (!publicKey)
      return null;

    this.vapidPublicKey = publicKey;
    return this.vapidPublicKey;
  }

  private async requestPermission(promptForDeniedPermission: boolean): Promise<NotificationPermission> {
    if (!('Notification' in window))
      return 'denied';

    if (Notification.permission === 'denied' && promptForDeniedPermission) {
      const shouldTryAgain = await this.showBlockedPermissionDialog();
      if (!shouldTryAgain)
        return Notification.permission;

      return this.requestPermissionAfterBlockedDialog();
    }

    if (Notification.permission !== 'default')
      return Notification.permission;

    if (this.hasDismissedPrePrompt() || this.hasAttemptedBrowserPrompt())
      return Notification.permission;

    const shouldRequestPermission = await this.showPermissionExplanationDialog();
    if (!shouldRequestPermission) {
      this.markPrePromptDismissed();
      return Notification.permission;
    }

    this.markBrowserPromptAttempted();
    return Notification.requestPermission();
  }

  private async requestPermissionAfterBlockedDialog(): Promise<NotificationPermission> {
    if (Notification.permission !== 'default')
      return Notification.permission;

    this.clearPermissionPromptSkips();
    return this.requestPermission(false);
  }

  private async showPermissionExplanationDialog(): Promise<boolean> {
    const dialogRef = this.dialog.open(WebPushPermissionDialogComponent, {
      autoFocus: false,
      disableClose: true,
      width: '480px',
      maxWidth: '95vw'
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return result === true;
  }

  private async showBlockedPermissionDialog(): Promise<boolean> {
    const dialogRef = this.dialog.open(WebPushBlockedDialogComponent, {
      autoFocus: false,
      disableClose: true,
      width: '520px',
      maxWidth: '95vw'
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return result === true;
  }

  private hasDismissedPrePrompt(): boolean {
    return localStorage.getItem(this.prePromptDismissedStorageKey) === 'true';
  }

  private markPrePromptDismissed(): void {
    localStorage.setItem(this.prePromptDismissedStorageKey, 'true');
  }

  private hasAttemptedBrowserPrompt(): boolean {
    return localStorage.getItem(this.browserPromptAttemptedStorageKey) === 'true';
  }

  private markBrowserPromptAttempted(): void {
    localStorage.setItem(this.browserPromptAttemptedStorageKey, 'true');
  }

  private clearPermissionPromptSkips(): void {
    localStorage.removeItem(this.prePromptDismissedStorageKey);
    localStorage.removeItem(this.browserPromptAttemptedStorageKey);
  }

  private savePermissionStatus(permission: NotificationPermission): void {
    localStorage.setItem(this.permissionStorageKey, permission);
  }

  private toRequestPayload(subscription: PushSubscription, permission: NotificationPermission): WebPushSubscriptionRequest | null {
    const payload = subscription.toJSON();
    const keys = payload.keys;

    const p256dh = keys?.['p256dh'];
    const auth = keys?.['auth'];

    if (!payload.endpoint || !p256dh || !auth)
      return null;

    return {
      endpoint: payload.endpoint,
      p256dh: p256dh,
      auth: auth,
      userAgent: navigator.userAgent ?? '',
      deviceType: this.resolveDeviceType(),
      permissionStatus: permission
    };
  }

  private resolveDeviceType(): WebPushDeviceType {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
    const iOSStandalone = navigatorWithStandalone.standalone === true;

    if (displayModeStandalone || iOSStandalone)
      return WebPushDeviceType.Pwa;

    const userAgent = navigator.userAgent ?? '';
    if (/android|iphone|ipad|ipod|windows phone|mobile/i.test(userAgent))
      return WebPushDeviceType.Mobile;

    return WebPushDeviceType.Browser;
  }

  private isWebPushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  private base64UrlToArrayBuffer(base64UrlString: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64UrlString.length % 4)) % 4);
    const base64 = (base64UrlString + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = this.document.defaultView?.atob(base64) ?? atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let index = 0; index < rawData.length; index++)
      outputArray[index] = rawData.charCodeAt(index);

    return outputArray.buffer;
  }
}
