import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, concatMap, map } from 'rxjs';
import { User } from '../models/user';
import { tap } from 'rxjs';
import { TokenService } from './token.service';
import { catchError, throwError } from 'rxjs';
const USER_DATA = "user_data";

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private loggedUser: Subject<User> = new BehaviorSubject<User>(new User());
  loggedUser$: Observable<User> = this.loggedUser.asObservable();

  constructor(private http: HttpClient, private tokenSerive: TokenService) {
    const user = localStorage.getItem(USER_DATA);

    if (user) {
      this.loggedUser.next(JSON.parse(user));
    }
  }

  public refreshUserInfo(): Observable<User> {
    return this.http.get<User>('/api/account/', {
      observe: 'body',
      responseType: 'json'
    }).pipe(map(user => {
      this.loggedUser.next(user);
      localStorage.setItem(USER_DATA, JSON.stringify(user));
      return user;
    }));
  }

  public removeUserInfo() {
    this.tokenSerive.clearToken();
    this.loggedUser.next(new User());
    localStorage.removeItem(USER_DATA);
  }

  public setUserInfo(firstName: string, lastName: string, preferredCurrency: string): Observable<User> {
    return this.http.put('/api/account/', {
      firstName: firstName,
      lastName: lastName,
      preferredCurrency: preferredCurrency
    }).pipe(concatMap(res => {
        return this.refreshUserInfo();
      }));
  }

  public manageInfo(newEmail: string = '', newPassword: string = '', oldPassword: string = '') {
    return this.http.post('/api/account/manage/info/', {
      newEmail: newEmail,
      newPassword: newPassword,
      oldPassword: oldPassword
    }).pipe(concatMap(res => {
      return this.refreshUserInfo();
    }));
  }

  public deleteUser(token?: string) {
    const options = token
      ? {
          body: { ConfirmationToken: token }, 
        }
      : undefined; 
  
    return this.http.delete('/api/account/', options).pipe(
      tap(() => console.log('Delete request sent')),
      catchError((error) => {
        console.error('Error occurred during deletion:', error);
        return throwError(() => error);
      })
    );
  }
}
