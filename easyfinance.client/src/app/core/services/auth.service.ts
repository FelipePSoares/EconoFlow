import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, concatMap, map } from 'rxjs';
import { UserService } from '../services/user.service';

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

  public signIn(email: string, password: string) {
    return this.http.post('/api/account/login?useCookies=true', {
      email: email,
      password: password
    }, {
      observe: 'response',
      responseType: 'text'
    })
      .pipe(concatMap((res: HttpResponse<string>) => {
        return this.userService.refreshUserInfo();
      }));
  }

  public signOut() {
    this.userService.removeUserInfo();

    return this.http.post('/api/account/logout', null, {
      observe: 'response',
      responseType: 'text'
    });
  }

  public register(email: string, password: string) {
    return this.http.post('/api/account/register', {
      email: email,
      password: password
    }, {
      observe: 'response',
      responseType: 'text'
    }).pipe<boolean>(map((res: HttpResponse<string>) => res.ok));
  }
}
