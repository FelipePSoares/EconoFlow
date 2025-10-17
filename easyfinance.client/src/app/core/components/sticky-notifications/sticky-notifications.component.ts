import { Component } from '@angular/core';
import { Observable, filter, map, startWith } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../services/notification.service';
import { NotificationType } from '../../enums/notification-type';
import { Notification } from '../../models/notification';
import { NavigationEnd, Router } from '@angular/router';

@Component({
  selector: 'app-sticky-notifications',
  imports: [
    AsyncPipe,
    TranslateModule
  ],
  templateUrl: './sticky-notifications.component.html',
  styleUrl: './sticky-notifications.component.css'
})
export class StickyNotificationsComponent {
  stickyNotifications$: Observable<Notification[]> = this.notificationService.notifications$.pipe(map(n => n.filter(n2 => n2.isSticky)));
  isUserUrl$: Observable<boolean>;

  constructor(private notificationService: NotificationService, private router: Router) {
    this.isUserUrl$ = this.router.events.pipe(
      filter(ev => ev instanceof NavigationEnd),
      startWith(null),
      map(() => this.urlIsUnderUser(this.router.url))
    );
  }

  public action(id: string, notificationType: NotificationType) {
    this.notificationService.action(id, notificationType);
  }

  private urlIsUnderUser(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return path === '/user' || path.startsWith('/user/');
  }
}
