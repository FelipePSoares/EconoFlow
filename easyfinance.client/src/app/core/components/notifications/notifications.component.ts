import { Component, ElementRef, ViewChild } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { map, Observable } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../services/notification.service';
import { Notification } from '../../models/notification';

@Component({
  selector: 'app-notifications',
  imports: [
    AsyncPipe,
    TranslateModule
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent {
  @ViewChild('notificationsToggleButton') notificationsToggleButton?: ElementRef<HTMLButtonElement>;
  notifications$: Observable<Notification[]> = this.notificationService.notifications$;
  unreadCount$: Observable<number> = this.notifications$.pipe(map(notifications => notifications?.length ?? 0));
  private readonly removeAnimationMs = 180;
  removingNotificationIds = new Set<string>();

  constructor(private notificationService: NotificationService) { }

  public onActionButtonClick(notification: Notification, event: Event): void {
    event.stopPropagation();
    this.notificationService.action(notification);
    this.closeDropdown();
  }

  public onSetAsReadClick(notification: Notification, event: Event): void {
    event.stopPropagation();
    if (this.removingNotificationIds.has(notification.id))
      return;

    this.removingNotificationIds.add(notification.id);
    setTimeout(() => {
      this.notificationService
        .markAsRead(notification.id)
        .add(() => this.removingNotificationIds.delete(notification.id));
    }, this.removeAnimationMs);
  }

  public isRemoving(notificationId: string): boolean {
    return this.removingNotificationIds.has(notificationId);
  }

  private closeDropdown(): void {
    const toggleButton = this.notificationsToggleButton?.nativeElement;
    if (!toggleButton || !toggleButton.classList.contains('show'))
      return;

    toggleButton.click();
  }
}
