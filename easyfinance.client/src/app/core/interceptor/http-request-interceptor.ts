import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, catchError, of, switchMap, take, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { inject, Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';
import { ApiErrorResponse } from '../models/error';
import { SnackbarComponent } from '../components/snackbar/snackbar.component';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<boolean>(false);

export const HttpRequestInterceptor: HttpInterceptorFn = (req, next) => {
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
          // If a refresh is already in progress, wait for it to complete
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

            // Retry the original request
            return next(req);
          }),
          catchError(err => {
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
      } else {
        console.error(`GenericError: ${JSON.stringify(err?.error)}`);
        apiErrorResponse.errors['general'] = ['GenericError']; 
      }

      return throwError(() => apiErrorResponse);
    }));
}
