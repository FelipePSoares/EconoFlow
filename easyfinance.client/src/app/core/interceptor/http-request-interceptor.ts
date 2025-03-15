import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, catchError, of, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { ApiErrorResponse } from '../models/error';
import { SnackbarComponent } from '../components/snackbar/snackbar.component';
import { MatDialog } from '@angular/material/dialog';

export const HttpRequestInterceptor: HttpInterceptorFn = (req, next) => {
  var router = inject(Router);
  var authService = inject(AuthService);
  var snackBar = inject(SnackbarComponent);
  var matDialog = inject(MatDialog);

  req = req.clone({
    withCredentials: true
  });

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
    catchError(err => handleAuthError(err, router, authService, snackBar, matDialog)));
}

function handleAuthError(err: HttpErrorResponse, router: Router, authService: AuthService, snackBar: SnackbarComponent, matDialog: MatDialog): Observable<any> {
  if (err.status === 0) {
    snackBar.openErrorSnackbar('Network error. Please check your connection.');
  } 
  else if ((err.status === 401 || err.status === 403) && !err.url?.includes('logout') && !err.url?.includes('login')) {
    console.log('authInterceptor 401 or 403');
    try { authService.signOut().subscribe(); } catch (e) { } // silent catch to avoid stop the redirection
    router.navigate(['login']);
    matDialog.closeAll();

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
}
