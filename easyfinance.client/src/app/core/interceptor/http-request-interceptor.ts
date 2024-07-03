import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';

export const HttpRequestInterceptor: HttpInterceptorFn = (req, next) => {
  req = req.clone({
    withCredentials: true
  });

  return next(req).pipe(catchError(x => handleAuthError(x)));
}

function handleAuthError(err: HttpErrorResponse): Observable<any> {
  var router = inject(Router);
  var authService = inject(AuthService);

  if ((err.status === 401 || err.status === 403) && !err.url?.includes('logout')) {
    authService.signOut();
    router.navigate(['login']);

    return of(err.message);
  }

  return throwError(() => err);
}
