import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, concatMap, map } from 'rxjs';
import { UserService } from '../services/user.service';
import { User } from '../models/User';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
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
        return this.userService.refreshUserInfo();
      }));
  }

  public signOut(): Observable<boolean> {
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
}
