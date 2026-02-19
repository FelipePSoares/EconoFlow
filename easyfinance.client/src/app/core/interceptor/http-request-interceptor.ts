import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, Subject, switchMap, take, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { inject, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';
import { ApiErrorResponse } from '../models/error';
import { SnackbarComponent } from '../components/snackbar/snackbar.component';

const exceptions: any = [
  { method: 'GET', url: 'assets/' },
  { method: 'GET', url: 'logout' }
];

const correlationIdHeaderName = 'X-Correlation-Id';
const anonymousClientIdStorageKey = 'anon_client_id';

let isRefreshing = false;
const refreshTokenSubject = new Subject<boolean>();

export const HttpRequestInterceptor: HttpInterceptorFn = (req, next) => {
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  const snackBar = inject(SnackbarComponent);
  const matDialog = inject(MatDialog);
  const injector = inject(Injector);
  
  req = req.clone({ withCredentials: true });

  if (isBrowser) {
    req = req.clone({
      headers: req.headers.set(correlationIdHeaderName, getOrCreateAnonymousClientId()),
    });
  }

  if (isException(req))
    return next(req);

  return next(req).pipe(
    tap((event) => {
      if (!(event instanceof HttpResponse) || !isBrowser)
        return;

      const translateService = injector.get(TranslateService);
      if (event.status === 201 && event.url?.includes('support')) {
        snackBar.openSuccessSnackbar(translateService.instant('MessageSuccess'));
      } else if (event.status === 201) {
        snackBar.openSuccessSnackbar(translateService.instant('CreatedSuccess'));
      }

      if (req.method === 'DELETE' && event.status === 200) {
        snackBar.openSuccessSnackbar(translateService.instant('DeletedSuccess'));
      }
    }),
    catchError(err => {
      const authService = injector.get(AuthService);

      if (err.status === 0 && isBrowser) {
        const translateService = injector.get(TranslateService);
        snackBar.openErrorSnackbar(translateService.instant('NetworkError'));
      }

      const isUnauthorized = err.status === 401;
      const isForbidden = err.status === 403;
      const requestUrl = String(err.url || req.url || '');
      const isRefreshRequest = requestUrl.includes('refresh-token');
      const isLogoutRequest = requestUrl.includes('logout');
      const isLoginRequest = requestUrl.includes('login');

      // Try refresh only in browser for non-auth endpoints
      if (isBrowser && isUnauthorized && !isRefreshRequest && !isLogoutRequest && !isLoginRequest) {
        if (isRefreshing) {
          return refreshTokenSubject.pipe(
            take(1),
            switchMap(refreshed => {
              if (refreshed)
                return next(req);

              return throwError(() => err);
            })
          );
        }

        isRefreshing = true;

        return authService.refreshToken().pipe(
          take(1),
          switchMap(() => {
            isRefreshing = false;
            refreshTokenSubject.next(true);
            return next(req);
          }),
          catchError(refreshError => {
            isRefreshing = false;
            refreshTokenSubject.next(false);
            return throwError(() => refreshError);
          })
        );
      }

      if (isBrowser && (isUnauthorized || isForbidden) && !isRefreshRequest && !isLogoutRequest && !isLoginRequest) {
        const router = injector.get(Router);
        matDialog.closeAll();

        authService.signOut();
        router.navigate(['login']);

        return throwError(() => err);
      }

      const apiErrorResponse: ApiErrorResponse = { errors: {} } as ApiErrorResponse;

      if (err.error?.errors) {
        return throwError(() => err.error as ApiErrorResponse);
      } else if (isUnauthorized && isLoginRequest && err.error === 'LockedOut') {
        apiErrorResponse.errors['general'] = ['UserBlocked'];
      } else if (isUnauthorized && isLoginRequest) {
        apiErrorResponse.errors['general'] = ['LoginError'];
      } else if (err?.error) {
        console.error(`GenericError: ${JSON.stringify(err?.error)}`);
        apiErrorResponse.errors['general'] = ['GenericError'];
      } else {
        console.error(`GenericError: ${JSON.stringify(err)}`);
        apiErrorResponse.errors['general'] = ['GenericError'];
      }

      return throwError(() => apiErrorResponse);
    })
  );
};

const getOrCreateAnonymousClientId = (): string => {
  const existingClientId = localStorage.getItem(anonymousClientIdStorageKey);
  if (existingClientId)
    return existingClientId;

  const newClientId = crypto.randomUUID();
  localStorage.setItem(anonymousClientIdStorageKey, newClientId);
  return newClientId;
};

const isException = (req: any) => {
  return exceptions.some((exception: any) => {
    return exception.method === req.method && req.url.indexOf(exception.url) >= 0;
  });
};
