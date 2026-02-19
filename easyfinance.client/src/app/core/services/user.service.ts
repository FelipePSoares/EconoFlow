import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, concatMap, finalize, map, of, shareReplay, switchMap } from 'rxjs';
import { tap, catchError, throwError } from 'rxjs';
import { DeleteUser, User } from '../models/user';
import { LocalService } from './local.service';
import { Operation } from 'fast-json-patch';
import { GlobalService } from './global.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private globalService = inject(GlobalService);
  private localService = inject(LocalService);

  private loggedUser = new BehaviorSubject<User | undefined>(undefined);
  private checkStatusRequest$: Observable<boolean> | null = null;
  private refreshTokenRequest$: Observable<User> | null = null;
  loggedUser$ = this.loggedUser.asObservable().pipe(switchMap(user => {
    if (user)
      return of(user);

    return this.getLoggedUser();
  }));

  public getLoggedUser(): Observable<User> {
    return this.checkStatus().pipe(switchMap(isLogged => {
      if (!isLogged) {
        return this.refreshToken().pipe(
          map(user => user ?? new User()),
          tap(user => this.loggedUser.next(user)),
          catchError(() => {
            const user = new User();
            this.loggedUser.next(user);
            return of(user);
          })
        );
      }

      return this.localService.getData<User>(this.localService.USER_DATA).pipe(
        switchMap(user => {
          if (user)
            return of(user);

          return this.refreshUserInfo();
        }),
        map(user => user ?? new User()),
        tap(user => this.loggedUser.next(user))
      );
    }));
  }

  public signIn(email: string, password: string): Observable<User> {
    return this.http.post('/api/AccessControl/login', {
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
    if (this.refreshTokenRequest$) {
      return this.refreshTokenRequest$;
    }

    this.refreshTokenRequest$ = this.http.post('/api/AccessControl/refresh-token', null, {
      observe: 'body',
      responseType: 'json'
    }).pipe(
      concatMap(() => this.refreshUserInfo()),
      finalize(() => {
        this.refreshTokenRequest$ = null;
      }),
      shareReplay(1)
    );

    return this.refreshTokenRequest$;
  }

  public register(email: string, password: string, token?: string): Observable<User> {
    const query = token ? `?token=${token}` : '';

    return this.http.post('/api/AccessControl/register' + query, {
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

  public checkStatus(): Observable<boolean> {
    if (this.checkStatusRequest$) {
      return this.checkStatusRequest$;
    }

    this.checkStatusRequest$ = this.http.get<boolean>('/api/AccessControl/IsLogged', {
      observe: 'body',
      responseType: 'json'
    }).pipe(
      catchError(() => of(false)),
      finalize(() => {
        this.checkStatusRequest$ = null;
      }),
      shareReplay(1)
    );

    return this.checkStatusRequest$;
  }

  public refreshUserInfo(): Observable<User> {
    return this.http.get<User>('/api/AccessControl/', {
      observe: 'body',
      responseType: 'json'
    }).pipe(tap(user => {
      this.globalService.setLocale(user.languageCode);

      this.loggedUser.next(user);
      this.localService.saveData(this.localService.USER_DATA, user).subscribe();
    }));
  }

  public removeUserInfo() {
    this.loggedUser.next(new User());
    this.localService.clearData();
  }

  public update(patch: Operation[]): Observable<User> {
    return this.http.patch<User>('/api/AccessControl/', patch).pipe(tap(user => {
      this.globalService.setLocale(user.languageCode);

      this.loggedUser.next(user);
      this.localService.saveData(this.localService.USER_DATA, user).subscribe();
    }));
  }

  public manageInfo(newEmail = '', newPassword = '', oldPassword = '') {
    return this.http.post('/api/AccessControl/manage/info/', {
      newEmail: newEmail,
      newPassword: newPassword,
      oldPassword: oldPassword
    }).pipe(concatMap(() => {
      return this.refreshUserInfo();
    }));
  }

  public setDefaultProject(projectId: string) {
    return this.http.put(`/api/AccessControl/default-project/${projectId}`, {}).pipe(concatMap(() => {
      return this.refreshUserInfo();
    }));
  }

  public deleteUser(token?: string): Observable<DeleteUser> {
    const options = token
      ? {
          body: { ConfirmationToken: token }, 
        }
      : undefined; 
  
    return this.http.delete<DeleteUser>('/api/AccessControl/', options).pipe(
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

    return this.http.get<User[]>('/api/AccessControl/search', {
      observe: 'body',
      responseType: 'json',
      params: queryParams
    });
  }

  public resendVerification(): Observable<void> {
    return this.http.post<void>('/api/AccessControl/resendConfirmEmail', null, {
      observe: 'body',
      responseType: 'json'
    });
  }
}
