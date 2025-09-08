import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, concatMap, map, of, switchMap } from 'rxjs';
import { tap, catchError, throwError } from 'rxjs';
import { DeleteUser, User } from '../models/user';
import { LocalService } from './local.service';
import { Operation } from 'fast-json-patch';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private loggedUser = new BehaviorSubject<User | undefined>(undefined);
  loggedUser$ = this.loggedUser.asObservable().pipe(switchMap(user => {
    if (user)
      return of(user);

    return this.getLoggedUser();
  }));

  constructor(private http: HttpClient, private localService: LocalService) {
    this.getLoggedUser().subscribe();
  }

  public getLoggedUser(): Observable<User> {
    return this.localService.getData<User>(this.localService.USER_DATA).pipe(
      map(user => user ?? new User()),
      tap(user => this.loggedUser.next(user))
    );
  }

  public signIn(email: string, password: string): Observable<User> {
    return this.http.post('/api/account/login', {
      email: email,
      password: password
    }, {
      observe: 'body',
      responseType: 'json'
    })
    .pipe(
      concatMap(() => this.refreshUserInfo())
    );
  }

  public refreshToken(): Observable<User> {
    return this.http.post('/api/Account/refresh-token', null, {
      observe: 'body',
      responseType: 'json'
    })
    .pipe(
      concatMap(() => this.refreshUserInfo())
    );
  }

  public register(email: string, password: string, token?: string): Observable<User> {
    const query = token ? `?token=${token}` : '';

    return this.http.post('/api/account/register' + query, {
      email: email,
      password: password
    }, {
      observe: 'body',
      responseType: 'json'
    })
    .pipe(
      concatMap(() => this.refreshUserInfo())
    );
  }

  public refreshUserInfo(): Observable<User> {
    return this.http.get<User>('/api/account/', {
      observe: 'body',
      responseType: 'json'
    }).pipe(tap(user => {
      this.loggedUser.next(user);
      this.localService.saveData(this.localService.USER_DATA, user).subscribe();
    }));
  }

  public removeUserInfo() {
    this.loggedUser.next(new User());
    this.localService.clearData();
  }

  public setUserInfo(firstName: string, lastName: string): Observable<User> {
    return this.http.put('/api/account/', {
      firstName: firstName,
      lastName: lastName
    }).pipe(concatMap(() => {
        return this.refreshUserInfo();
      }));
  }

  public update(patch: Operation[]): Observable<User> {
    return this.http.patch<User>('/api/account/', patch).pipe(tap(() => this.refreshUserInfo().subscribe()));
  }

  public manageInfo(newEmail = '', newPassword = '', oldPassword = '') {
    return this.http.post('/api/account/manage/info/', {
      newEmail: newEmail,
      newPassword: newPassword,
      oldPassword: oldPassword
    }).pipe(concatMap(() => {
      return this.refreshUserInfo();
    }));
  }

  public setDefaultProject(projectId: string) {
    return this.http.put(`/api/account/default-project/${projectId}`, {}).pipe(concatMap(() => {
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
        return throwError(() => error);
      })
    );
  }

  public searchUser(searchTerm: string, projectId: string | undefined = undefined): Observable<User[]> {
    let queryParams = new HttpParams();
    queryParams = queryParams.append("searchTerm", searchTerm);

    if (projectId)
      queryParams = queryParams.append("projectId", projectId);

    return this.http.get<User[]>('/api/account/search', {
      observe: 'body',
      responseType: 'json',
      params: queryParams
    });
  }

  public resendVerification(): Observable<void> {
    return this.http.post<void>('/api/Account/resendConfirmEmail', null, {
      observe: 'body',
      responseType: 'json'
    });
  }
}
