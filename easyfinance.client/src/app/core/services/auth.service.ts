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

  isSignedIn$ : Observable<boolean>;
  isSignedOut$ : Observable<boolean>;

  constructor(private http: HttpClient, private userService: UserService) {
    this.isSignedIn$ = this.userService.loggedUser$.pipe(map(user => user.enabled));
    this.isSignedOut$ = this.isSignedIn$.pipe(map(isLoggedIn => !isLoggedIn));
  }

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

  public register(email: string, password: string): Observable<boolean> {
    return this.http.post('/api/account/register', {
      email: email,
      password: password
    }, {
      observe: 'response'
    }).pipe<boolean>(map(res => res.ok));
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
