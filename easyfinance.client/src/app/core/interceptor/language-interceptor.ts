import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { GlobalService } from '../services/global.service';

export const LanguageInterceptor: HttpInterceptorFn = (req, next) => {
  const globalService = inject(GlobalService);

  req = req.clone({
    headers: req.headers.set('Accept-Language', globalService.languageLoaded),
  });

  return next(req);
}
