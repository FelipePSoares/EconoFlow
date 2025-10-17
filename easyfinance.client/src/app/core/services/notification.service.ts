import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, interval, switchMap, tap, startWith } from 'rxjs';
import { Router } from '@angular/router';
import { NotificationCategory } from '../enums/notification-category';
import { NotificationType } from '../enums/notification-type';
import { Notification } from '../models/notification';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private pollingSubscription: Subscription | null = null;

  private notifications = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notifications.asObservable();

  constructor(private http: HttpClient, private router: Router) { }

  public action(id: string, notificationType: NotificationType) {
    switch (notificationType) {
      case NotificationType.EmailConfirmation: {
        this.router.navigate(['/user/emails']);
        break;
      }
      default: {
        this.markAsRead(id);
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
    return this.http.post(`/api/Account/Notifications/${id}/Read`, {}, {
      observe: 'body',
      responseType: 'json'
    }).pipe(tap(() => {
      this.getNotifications().subscribe(notifications => this.notifications.next(notifications));
    })).subscribe();
  }

  public startPolling() {
    if (this.pollingSubscription) return;

    this.pollingSubscription = interval(300000) // 5 minute
      .pipe(
        startWith(0),
        switchMap(() =>
          this.getNotifications().pipe(tap(notifications => {
            console.log('Fetched notifications:', notifications);
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
}
