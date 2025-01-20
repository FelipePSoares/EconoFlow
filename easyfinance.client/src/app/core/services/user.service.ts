import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, concatMap, map } from 'rxjs';
import { DeleteUser, User } from '../models/user';
import { tap } from 'rxjs';
import { catchError, throwError } from 'rxjs';
import { SnackbarComponent } from '../components/snackbar/snackbar.component';
import { LocalService } from './local.service';
const USER_DATA = "user_data";

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private loggedUser: Subject<User> = new BehaviorSubject<User>(new User());
  loggedUser$: Observable<User> = this.loggedUser.asObservable();

  constructor(private http: HttpClient, private snackbar: SnackbarComponent, private localService: LocalService) {
    const user = localService.getData(USER_DATA);

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

      this.localService.saveData(USER_DATA, JSON.stringify(user));
      return user;
    }));
  }

  public removeUserInfo() {
    this.loggedUser.next(new User());
    this.localService.removeData(USER_DATA);
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

  public deleteUser(token?: string): Observable<DeleteUser> {
    const options = token
      ? {
          body: { ConfirmationToken: token }, 
        }
      : undefined; 
  
    return this.http.delete<DeleteUser>('/api/account/', options).pipe(
      tap(() => console.log('Delete request sent')),
      catchError((error) => {
        console.error('Error occurred during deletion:', error);
        this.snackbar.openErrorSnackbar('Failed to delete account. Please try again later');
        return throwError(() => error);
      })
    );
  }
}
