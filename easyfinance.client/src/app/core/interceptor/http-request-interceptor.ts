import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, Subject, switchMap, take, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { inject, Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';
import { ApiErrorResponse } from '../models/error';
import { SnackbarComponent } from '../components/snackbar/snackbar.component';

const exceptions: any = [
  { method: 'GET', url: 'assets/' }
];

let isRefreshing = false;

// Use Subject instead of BehaviorSubject - only emits when refresh completes
const refreshTokenSubject = new Subject<boolean>();

export const HttpRequestInterceptor: HttpInterceptorFn = (req, next) => {  
  if (isException(req))
    return next(req);

  const snackBar = inject(SnackbarComponent);
  const matDialog = inject(MatDialog);
  const injector = inject(Injector);

  // Always add credentials
  req = req.clone({ withCredentials: true });

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        const translateService = injector.get(TranslateService);
        if (event.status === 201 && event.url?.includes('support')) {
          snackBar.openSuccessSnackbar(translateService.instant('MessageSuccess'));
        } 
        else if (event.status === 201) {
          snackBar.openSuccessSnackbar(translateService.instant('CreatedSuccess'));
        }
        if (req.method === 'DELETE' && event.status === 200) {
          snackBar.openSuccessSnackbar(translateService.instant('DeletedSuccess'));
        }
      }
    }),
    catchError(err => {
      const authService = injector.get(AuthService);

      // Network error
      if (err.status === 0) {
        const translateService = injector.get(TranslateService);
        snackBar.openErrorSnackbar(translateService.instant('NetworkError'));
      }

      // Token expired (401) → try refresh
      if (err.status === 401 && !err.url?.includes('refresh-token') && !err.url?.includes('logout') && !err.url?.includes('login')) {
        if (isRefreshing) {
          // Wait for the refresh to complete
          return refreshTokenSubject.pipe(
            take(1),
            switchMap(refreshed => {
              if (refreshed) {
                // Refresh succeeded, retry original request
                return next(req);
              } else {
                // Refresh failed, propagate error
                return throwError(() => err);
              }
            })
          );
        }

        isRefreshing = true;

        return authService.refreshToken().pipe(
          take(1),
          switchMap(() => {
            // Refresh successful
            isRefreshing = false;
            refreshTokenSubject.next(true);

            // Retry the original request
            return next(req);
          }),
          catchError(err => {
            // Refresh failed
            isRefreshing = false;
            refreshTokenSubject.next(false);
            return throwError(() => err);
          })
        );
      }
      else if ((err.status === 401 || err.status === 403) && !err.url?.includes('logout') && !err.url?.includes('login')) {
        const router = injector.get(Router);
        matDialog.closeAll();

        authService.signOut();
        router.navigate(['login']);

        return throwError(() => err);
      }
      let apiErrorResponse: ApiErrorResponse = { errors: {} } as ApiErrorResponse;

      if (err.error?.errors) {
        apiErrorResponse = err.error as ApiErrorResponse;
      } else if (err.status === 401 && err.url?.includes('login') && err.error === 'LockedOut') {
        apiErrorResponse.errors['general'] = ['UserBlocked'];
      } else if (err.status === 401 && err.url?.includes('login')) {
        apiErrorResponse.errors['general'] = ['LoginError'];
      } else if (err?.error) {
        console.error(`GenericError: ${JSON.stringify(err?.error)}`);
        apiErrorResponse.errors['general'] = ['GenericError']; 
      } else {
        console.error(`GenericError: ${JSON.stringify(err)}`);
        apiErrorResponse.errors['general'] = ['GenericError']; 
      }

      return throwError(() => apiErrorResponse);
    }));
}

const isException = (req: any) => {
  return exceptions.some((exception: any) => {
    return exception.method === req.method && req.url.indexOf(exception.url) >= 0;
  });
}
