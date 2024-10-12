import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { ApiErrorResponse } from '../models/error';

export const HttpRequestInterceptor: HttpInterceptorFn = (req, next) => {
  var router = inject(Router);
  var authService = inject(AuthService);

  req = req.clone({
    withCredentials: true
  });

  return next(req).pipe(catchError(err => handleAuthError(err, router, authService)));
}

function handleAuthError(err: HttpErrorResponse, router: Router, authService: AuthService): Observable<any> {
  if ((err.status === 401 || err.status === 403) && !err.url?.includes('logout') && !err.url?.includes('login')) {
    console.log('authInterceptor 401 or 403');
    try { authService.signOut().subscribe(); } catch (e) { } // silent catch to avoid stop the redirection
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
}
