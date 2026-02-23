import { HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { catchError, Subject, switchMap, take, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { inject, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';
import { ApiErrorResponse } from '../models/error';
import { SnackbarComponent } from '../components/snackbar/snackbar.component';

interface RequestException {
  method: string;
  url: string;
}

const exceptions: RequestException[] = [
  { method: 'GET', url: 'assets/' },
  { method: 'GET', url: 'logout' }
];

const correlationIdHeaderName = 'X-Correlation-Id';
const anonymousClientIdStorageKey = 'anon_client_id';
const loginFailureCodeLockedOut = 'LockedOut';
const loginFailureCodeInvalidCredentials = 'InvalidCredentials';
const loginFailureCodeTwoFactorRequired = 'TwoFactorRequired';
const loginFailureCodeInvalidTwoFactorCode = 'InvalidTwoFactorCode';
const loginFailureCodeInvalidTwoFactorRecoveryCode = 'InvalidTwoFactorRecoveryCode';

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
            const router = injector.get(Router);
            redirectToLogin(authService, router, matDialog);

            return throwError(() => refreshError);
          })
        );
      }

      if (isBrowser && (isUnauthorized || isForbidden) && !isRefreshRequest && !isLogoutRequest && !isLoginRequest) {
        const router = injector.get(Router);
        redirectToLogin(authService, router, matDialog);

        return throwError(() => err);
      }

      const apiErrorResponse: ApiErrorResponse = { errors: {} } as ApiErrorResponse;

      if (err.error?.errors) {
        return throwError(() => err.error as ApiErrorResponse);
      } else if (isUnauthorized && isLoginRequest) {
        return throwError(() => createLoginErrorResponse(err.error));
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

const isException = (req: HttpRequest<unknown>) => {
  return exceptions.some((exception) => {
    return exception.method === req.method && req.url.indexOf(exception.url) >= 0;
  });
};

const redirectToLogin = (authService: AuthService, router: Router, matDialog: MatDialog): void => {
  matDialog.closeAll();
  authService.signOut();

  const currentUrl = router.url || '/';
  const isLoginRoute = currentUrl.startsWith('/login');

  if (isLoginRoute) {
    router.navigate(['login']);
    return;
  }

  router.navigate(['login'], { queryParams: { returnUrl: currentUrl } });
};

const createLoginErrorResponse = (loginError: unknown): ApiErrorResponse => {
  const apiErrorResponse: ApiErrorResponse = { errors: {} };
  const loginErrorCode = getLoginFailureCode(loginError);

  if (loginErrorCode === loginFailureCodeLockedOut) {
    apiErrorResponse.errors['general'] = ['UserBlocked'];
    return apiErrorResponse;
  }

  switch (loginErrorCode) {
    case loginFailureCodeTwoFactorRequired:
      apiErrorResponse.errors['general'] = ['TwoFactorRequired'];
      break;
    case loginFailureCodeInvalidTwoFactorCode:
      apiErrorResponse.errors['general'] = ['InvalidTwoFactorCode'];
      apiErrorResponse.errors['twoFactorCode'] = ['InvalidTwoFactorCode'];
      break;
    case loginFailureCodeInvalidTwoFactorRecoveryCode:
      apiErrorResponse.errors['general'] = ['InvalidTwoFactorRecoveryCode'];
      apiErrorResponse.errors['twoFactorRecoveryCode'] = ['InvalidTwoFactorRecoveryCode'];
      break;
    case loginFailureCodeInvalidCredentials:
    default:
      apiErrorResponse.errors['general'] = ['LoginError'];
      break;
  }

  return apiErrorResponse;
};

const getLoginFailureCode = (loginError: unknown): string => {
  if (typeof loginError === 'string')
    return loginError;

  if (typeof loginError === 'object' && loginError !== null) {
    const loginErrorPayload = loginError as { code?: string; requiresTwoFactor?: boolean };

    if (typeof loginErrorPayload.code === 'string' && loginErrorPayload.code.length > 0)
      return loginErrorPayload.code;

    if (loginErrorPayload.requiresTwoFactor)
      return loginFailureCodeTwoFactorRequired;
  }

  return loginFailureCodeInvalidCredentials;
};
