import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subscription, concatMap, interval, map, switchMap } from 'rxjs';
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
    return this.http.post('/api/account/login?useCookies=true', {
      email: email,
      password: password
    }, {
      observe: 'response'
    })
      .pipe(concatMap(res => {
        this.startUserPolling();

        return this.userService.refreshUserInfo();
      }));
  }

  public signOut(): Observable<boolean> {
    this.stopUserPolling();
    this.userService.removeUserInfo();

    return this.http.post('/api/account/logout', null, {
      observe: 'response'
    }).pipe<boolean>(map(res => res.ok));
  }

  public register(email: string, password: string, token?: string): Observable<User> {
    var query = token ? `?token=${token}` : '';

    return this.http.post('/api/account/register' + query, {
      email: email,
      password: password
    }, {
      observe: 'response'
    }).pipe(concatMap(res => {
      this.startUserPolling();

      return this.userService.refreshUserInfo();
    }));
  }

  public forgotPassword(email: string): Observable<boolean> {
    return this.http.post('/api/account/forgotPassword', {
      email: email
    }, {
      observe: 'response'
    }).pipe<boolean>(map(res => res.ok));
  }

  public resetPassword(email: string, resetCode: string, newPassword: string): Observable<boolean> {
    return this.http.post('/api/account/resetPassword', {
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
