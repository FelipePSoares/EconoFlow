import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { GlobalService } from '../services/global.service';
import { isPlatformBrowser } from '@angular/common';

export const LanguageInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId) && !req.url?.includes('encryption/UserKey')) {
    const globalService = inject(GlobalService);

    req = req.clone({
      headers: req.headers.set('Accept-Language', globalService.languageLoaded),
    });
  }

  return next(req);
}
