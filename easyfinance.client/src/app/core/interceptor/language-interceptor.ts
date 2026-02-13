import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { GlobalService } from '../services/global.service';
import { isPlatformBrowser } from '@angular/common';

const exceptions: any = [
  { method: 'GET', url: 'assets/' }
];

export const LanguageInterceptor: HttpInterceptorFn = (req, next) => {

  if (isException(req))
    return next(req);

  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId) && !req.url?.includes('encryption/UserKey')) {
    const globalService = inject(GlobalService);

    req = req.clone({
      headers: req.headers.set('Accept-Language', globalService.currentLanguage),
    });
  }

  return next(req);
}

const isException = (req: any) => {
  return exceptions.some((exception: any) => {
    return exception.method === req.method && req.url.indexOf(exception.url) >= 0;
  });
}
