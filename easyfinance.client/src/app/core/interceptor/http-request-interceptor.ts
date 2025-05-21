import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, of, switchMap, take, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { inject, Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';
import { ApiErrorResponse } from '../models/error';
import { SnackbarComponent } from '../components/snackbar/snackbar.component';
import { LocalService } from '../services/local.service';
import { Token } from '../models/token';

export const HttpRequestInterceptor: HttpInterceptorFn = (req, next) => {
  var localService = inject(LocalService);
  var snackBar = inject(SnackbarComponent);
  var matDialog = inject(MatDialog);
  var injector = inject(Injector);

  const token = localService.getData<Token>(localService.TOKEN_DATA);

  if (token) {
    req = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token.accessToken}`),
    });
  }

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        console.log(" type " , event.url);
        let translateService = injector.get(TranslateService);
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
      let authService = injector.get(AuthService);

      if (err.status === 0) {
        let translateService = injector.get(TranslateService);
        snackBar.openErrorSnackbar(translateService.instant('NetworkError'));
      }
      if (err.status === 401 && token && !err.url?.includes('refresh-token') && !err.url?.includes('logout') && !err.url?.includes('login')) {
        return authService.refreshToken().pipe(
          take(1),
          switchMap(() => {
            const newToken = localService.getData<Token>(localService.TOKEN_DATA);

            if (newToken) {
              return next(req.clone({
                headers: req.headers.set('Authorization', `Bearer ${newToken.accessToken}`),
              }));
            }

            return throwError(err);
          })
        );
      }
      else if ((err.status === 401 || err.status === 403) && !err.url?.includes('logout') && !err.url?.includes('login')) {
        var router = injector.get(Router);
        matDialog.closeAll();

        authService.signOut();
        router.navigate(['login']);

        return of(err.message);
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
