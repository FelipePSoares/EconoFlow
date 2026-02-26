import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, concatMap, finalize, map, of, shareReplay, switchMap } from 'rxjs';
import { tap, catchError, throwError } from 'rxjs';
import { DeleteUser, User } from '../models/user';
import { LocalService } from './local.service';
import { Operation } from 'fast-json-patch';
import { GlobalService } from './global.service';
import {
  TwoFactorEnableResponse,
  TwoFactorRecoveryCodesResponse,
  TwoFactorSecureActionRequest,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse
} from '../models/two-factor';

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
  private twoFactorSetupRequest$: Observable<TwoFactorSetupResponse> | null = null;
  private twoFactorSetupCache: TwoFactorSetupResponse | null = null;
  private twoFactorSetupCachedAt: number | null = null;
  private readonly twoFactorSetupCacheTtlMs = 5 * 60 * 1000;
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
          if (user && Array.isArray(user.enabledFeatures))
            return of(user);

          return this.refreshUserInfo();
        }),
        map(user => user ?? new User()),
        tap(user => this.loggedUser.next(user))
      );
    }));
  }

  public signIn(email: string, password: string, twoFactorCode?: string, twoFactorRecoveryCode?: string): Observable<User> {
    return this.http.post('/api/AccessControl/login', {
      email: email,
      password: password,
      twoFactorCode: twoFactorCode,
      twoFactorRecoveryCode: twoFactorRecoveryCode
    }, {
      observe: 'body',
      responseType: 'json'
    })
    .pipe(
      concatMap(() => this.refreshUserInfo())
    );
  }

  public getTwoFactorSetup(forceRefresh = false): Observable<TwoFactorSetupResponse> {
    if (forceRefresh)
      this.clearTwoFactorSetupCache();

    if (this.hasValidTwoFactorSetupCache())
      return of(this.twoFactorSetupCache as TwoFactorSetupResponse);

    if (this.twoFactorSetupRequest$)
      return this.twoFactorSetupRequest$;

    this.twoFactorSetupRequest$ = this.http.get<TwoFactorSetupResponse>('/api/AccessControl/2fa/setup', {
      observe: 'body',
      responseType: 'json'
    }).pipe(
      tap(response => {
        this.twoFactorSetupCache = response;
        this.twoFactorSetupCachedAt = Date.now();
      }),
      finalize(() => {
        this.twoFactorSetupRequest$ = null;
      }),
      shareReplay(1)
    );

    return this.twoFactorSetupRequest$;
  }

  public prefetchTwoFactorSetup(): void {
    this.getTwoFactorSetup().subscribe({
      error: () => {
        // Prefetch should be opportunistic and silent.
      }
    });
  }

  public enableTwoFactor(code: string): Observable<TwoFactorEnableResponse> {
    return this.http.post<TwoFactorEnableResponse>('/api/AccessControl/2fa/enable', { code: code }, {
      observe: 'body',
      responseType: 'json'
    }).pipe(tap(() => {
      this.clearTwoFactorSetupCache();
    }),
      concatMap(response => this.refreshUserInfo().pipe(map(() => response)))
    );
  }

  public disableTwoFactor(request: TwoFactorSecureActionRequest): Observable<TwoFactorStatusResponse> {
    return this.http.post<TwoFactorStatusResponse>('/api/AccessControl/2fa/disable', request, {
      observe: 'body',
      responseType: 'json'
    }).pipe(tap(() => {
      this.clearTwoFactorSetupCache();
    }),
      concatMap(response => this.refreshUserInfo().pipe(map(() => response)))
    );
  }

  public regenerateTwoFactorRecoveryCodes(request: TwoFactorSecureActionRequest): Observable<TwoFactorRecoveryCodesResponse> {
    return this.http.post<TwoFactorRecoveryCodesResponse>('/api/AccessControl/2fa/recovery-codes/regenerate', request, {
      observe: 'body',
      responseType: 'json'
    });
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
    this.clearTwoFactorSetupCache();
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

  private hasValidTwoFactorSetupCache(): boolean {
    if (!this.twoFactorSetupCache || this.twoFactorSetupCachedAt === null)
      return false;

    return (Date.now() - this.twoFactorSetupCachedAt) <= this.twoFactorSetupCacheTtlMs;
  }

  private clearTwoFactorSetupCache(): void {
    this.twoFactorSetupCache = null;
    this.twoFactorSetupCachedAt = null;
  }
}
