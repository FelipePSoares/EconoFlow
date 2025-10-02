import { Router } from '@angular/router';
import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { map, Observable } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../services/notification.service';
import { Notification } from '../../models/notification';
import { NotificationType } from '../../enums/notification-type';

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
  notifications$: Observable<Notification[]> = this.notificationService.notifications$;
  unreadCount$: Observable<number> = this.notifications$.pipe(map(notifications => notifications?.length ?? 0));

  constructor(private notificationService: NotificationService, private router: Router) { }

  public action(id: string, notificationType: NotificationType) {
    switch (notificationType) {
      case NotificationType.EmailConfirmation: {
        this.router.navigate(['/user/emails']);
        break;
      }
      default: {
        this.notificationService.markAsRead(id);
        break;
      }
    } 
  }
}
