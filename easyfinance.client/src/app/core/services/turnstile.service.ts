import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';

export interface CaptchaConfig {
  siteKey: string;
  enabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TurnstileService {
  private http = inject(HttpClient);
  private config$ = new BehaviorSubject<CaptchaConfig | null>(null);
  private configLoaded = false;

  loadConfig(): Observable<CaptchaConfig> {
    if (this.configLoaded && this.config$.value) {
      return of(this.config$.value);
    }

    return this.http.get<CaptchaConfig>('/api/AccessControl/captcha-config').pipe(
      tap(config => {
        this.config$.next(config);
        this.configLoaded = true;
      }),
      catchError(() => {
        const fallback: CaptchaConfig = { siteKey: '', enabled: false };
        this.config$.next(fallback);
        this.configLoaded = true;
        return of(fallback);
      })
    );
  }

  getConfig(): CaptchaConfig | null {
    return this.config$.value;
  }

  get isEnabled(): boolean {
    return this.config$.value?.enabled ?? false;
  }

  get siteKey(): string {
    return this.config$.value?.siteKey ?? '';
  }
}
