import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subscription, interval, map, switchMap } from 'rxjs';
import { UserService } from '../services/user.service';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private pollingSubscription: Subscription | null = null;

  isSignedIn$: Observable<boolean> = this.userService.loggedUser$.pipe(map(user => user.enabled));
  isSignedOut$: Observable<boolean> = this.isSignedIn$.pipe(map(isLoggedIn => !isLoggedIn));

  constructor(private http: HttpClient, private userService: UserService) { }

  public signIn(email: string, password: string): Observable<User> {
    return this.userService.signIn(email, password)
      .pipe(map(user => {
        this.startUserPolling();
        return user;
      }));
  }

  public refreshToken(): Observable<User> {
    return this.userService.refreshToken().pipe(map(user => {
      return user;
    }));
  }

  public signOut(): void {
    this.stopUserPolling();

    this.http.post('/api/AccessControl/logout', null, {
      observe: 'response'
    });

    this.userService.removeUserInfo();
  }

  public register(email: string, password: string, token?: string): Observable<User> {
    return this.userService.register(email, password, token).pipe(map(user => {
      this.startUserPolling();
      return user;
    }));
  }

  public forgotPassword(email: string): Observable<boolean> {
    return this.http.post('/api/AccessControl/forgotPassword', {
      email: email
    }, {
      observe: 'response'
    }).pipe<boolean>(map(res => res.ok));
  }

  public resetPassword(email: string, resetCode: string, newPassword: string): Observable<boolean> {
    return this.http.post('/api/AccessControl/resetPassword', {
      email: email,
      resetCode: resetCode,
      newPassword: newPassword
    }, {
      observe: 'response'
    }).pipe<boolean>(map(res => res.ok));
  }

  public startUserPolling() {
    if (this.pollingSubscription) return;

    this.pollingSubscription = interval(30000) // 30 seconds
      .pipe(switchMap(() => this.userService.refreshUserInfo()))
      .subscribe();
  }

  public stopUserPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }
}
