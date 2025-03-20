import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, finalize, of, switchMap, take, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../services/auth.service';
import { ApiErrorResponse } from '../models/error';
import { SnackbarComponent } from '../components/snackbar/snackbar.component';
import { LocalService } from '../services/local.service';
import { Token } from '../models/token';

export const HttpRequestInterceptor: HttpInterceptorFn = (req, next) => {
  var router = inject(Router);
  var authService = inject(AuthService);
  var localService = inject(LocalService);
  var snackBar = inject(SnackbarComponent);
  var matDialog = inject(MatDialog);

  const token = localService.getData<Token>(localService.TOKEN_DATA);

  if (token) {
    req = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token.accessToken}`),
    });
  }

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        if (event.status === 201) {
          snackBar.openSuccessSnackbar('Created successfully!');
        }
        if (req.method === 'DELETE' && event.status === 204) {
          snackBar.openSuccessSnackbar('Deleted successfully!');
        }
      }
    }),
    catchError(err => {
      if (err.status === 0) {
        snackBar.openErrorSnackbar('Network error. Please check your connection.');
      }
      if (err.status === 401 && token && !err.url?.includes('refresh-token') && !err.url?.includes('logout') && !err.url?.includes('login')) {
        return authService.refreshToken().pipe(
          take(1),
          switchMap(() => {
            const newToken = localService.getData<Token>(localService.TOKEN_DATA);

            return next(req.clone({
              headers: req.headers.set('Authorization', `Bearer ${newToken?.accessToken}`),
            }));
          })
        );
      }
      else if ((err.status === 401 || err.status === 403) && !err.url?.includes('logout') && !err.url?.includes('login')) {
        matDialog.closeAll();

        authService.signOut();
        router.navigate(['login']);

        return of(err.message);
      }
      let apiErrorResponse: ApiErrorResponse = <ApiErrorResponse>{ errors: {} };

      if (err.error?.errors) {
        apiErrorResponse = err.error as ApiErrorResponse;
      } else if (err.status === 401 && err.url?.includes('login') && err.error?.detail === 'LockedOut') {
        apiErrorResponse.errors['general'] = 'User blocked!';
      } else if (err.status === 401 && err.url?.includes('login')) {
        apiErrorResponse.errors['general'] = 'Incorrect login information!';
      } else {
        apiErrorResponse.errors['general'] = 'An unexpected error occurs, try again...';
      }

      return throwError(() => apiErrorResponse);
    }));
}
