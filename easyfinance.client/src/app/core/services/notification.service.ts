import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, catchError, interval, switchMap, tap, startWith, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { NotificationCategory } from '../enums/notification-category';
import { NotificationType } from '../enums/notification-type';
import { Notification } from '../models/notification';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private pollingSubscription: Subscription | null = null;

  private notifications = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notifications.asObservable();

  public action(notification: Notification) {
    const actionPath = this.resolveActionPath(notification);

    switch (notification.type) {
      case NotificationType.EmailConfirmation: {
        this.router.navigate(['/user/emails']);
        break;
      }
      case NotificationType.Information: {
        if (actionPath) {
          this.markAsRead(notification.id);
          this.router.navigateByUrl(actionPath);
          break;
        }

        this.markAsRead(notification.id);
        break;
      }
      default: {
        this.markAsRead(notification.id);
        break;
      }
    }
  }

  public getNotifications(category?: NotificationCategory): Observable<Notification[]> {
    let queryParams = new HttpParams();

    if (category)
      queryParams = queryParams.append("category", category);

    return this.http.get<Notification[]>('/api/Account/Notifications', {
      observe: 'body',
      responseType: 'json',
      params: queryParams
    });
  }

  public markAsRead(id: string): Subscription {
    const notifications = this.notifications.value;
    const notificationToRestore = notifications.find(notification => notification.id === id);
    const notificationIndex = notifications.findIndex(notification => notification.id === id);
    this.notifications.next(notifications.filter(notification => notification.id !== id));

    return this.http.post(`/api/Account/Notifications/${id}/Read`, {}, {
      observe: 'body',
      responseType: 'json'
    }).pipe(
      catchError(error => {
        if (notificationToRestore) {
          const currentNotifications = this.notifications.value;
          const alreadyInList = currentNotifications.some(notification => notification.id === id);
          if (!alreadyInList) {
            const restoredNotifications = [...currentNotifications];
            const insertionIndex = Math.min(notificationIndex, restoredNotifications.length);
            restoredNotifications.splice(insertionIndex, 0, notificationToRestore);
            this.notifications.next(restoredNotifications);
          }
        }

        return throwError(() => error);
      })
    ).subscribe();
  }

  public startPolling() {
    if (this.pollingSubscription) return;

    this.pollingSubscription = interval(300000) // 5 minute
      .pipe(
        startWith(0),
        switchMap(() =>
          this.getNotifications().pipe(tap(notifications => {
            this.notifications.next(notifications);
          }))))
      .subscribe();
  }

  public stopPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private resolveActionPath(notification: Notification): string | null {
    if (notification.actionLabelCode === 'ButtonMyProfile')
      return '/user';

    if (notification.actionLabelCode === 'ButtonConfigureTwoFactor')
      return '/user/authentication';

    return null;
  }
}
