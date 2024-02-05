import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse
} from '@angular/common/http';

import { Observable, catchError, map, of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable()
export class HttpRequestInterceptor implements HttpInterceptor {
  constructor(private router: Router, private authService: AuthService) { }

  private handleAuthError(err: HttpErrorResponse): Observable<any> {
    if ((err.status === 401 || err.status === 403) && !err.url?.includes('logout')) {
      this.authService.signOut();
      this.router.navigate(['login']);
      
      return of(err.message);
    }

    return throwError(() => err);
  }

  intercept(req: HttpRequest<any>, next: HttpHandler):
    Observable<HttpEvent<any>> {
      
    req = req.clone({
      withCredentials: true
    });

    return next.handle(req).pipe(catchError(x => this.handleAuthError(x)));
  }
}
