import { ApplicationConfig, CSP_NONCE, DOCUMENT, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { MAT_MOMENT_DATE_FORMATS, provideMomentDateAdapter } from '@angular/material-moment-adapter';
import { routes } from './features/app-routing.module';
import { HttpRequestInterceptor } from './core/interceptor/http-request-interceptor';
import { LoadingInterceptor } from './core/interceptor/loading.interceptor';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { importProvidersFrom, inject } from '@angular/core';
import { GlobalService } from './core/services/global.service';
import { TranslateHttpLoader } from './core/utils/loaders/translate-http-loader';
import { LanguageInterceptor } from './core/interceptor/language-interceptor';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    CurrencyPipe,
    DecimalPipe,
    GlobalService,
    provideAnimations(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' })
    ),
    provideMomentDateAdapter(MAT_MOMENT_DATE_FORMATS, { useUtc: true }),
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: (http: HttpClient) => new TranslateHttpLoader(http),
          deps: [HttpClient]
        },
        fallbackLang: 'en'
      })
    ),
    provideHttpClient(
      withInterceptors([
        HttpRequestInterceptor,
        LoadingInterceptor,
        LanguageInterceptor])
    ),
    provideClientHydration(withEventReplay()),
    provideServiceWorker('service-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    {
      provide: CSP_NONCE,
      useFactory: () => {
        const doc = inject(DOCUMENT);
        return doc?.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? null;
      }
    }
  ],
};
