import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';
import { LoaderService } from '../services/loader.service';

const exceptions: any = [
  { method: 'GET', url: '/api/account/' },
  { method: 'GET', url: '/api/account/search' },
  { method: 'GET', url: '/DefaultCategories' }
];

var totalRequests = 0;

export const LoadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoaderService);

  if (!isException(req)) {
    totalRequests++;
    loadingService.setLoading(true);
  }

  return next(req).pipe(
    finalize(() => {
      if (!isException(req)) {
        totalRequests--;
        if (totalRequests == 0) {
          loadingService.setLoading(false);
        }
      }
    })
  );
}

const isException = (req: any) => {
  return exceptions.some((exception: any) => {
    return exception.method === req.method && req.url.indexOf(exception.url) >= 0;
  });
}
