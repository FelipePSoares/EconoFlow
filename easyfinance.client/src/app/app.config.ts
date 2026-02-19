import { ApplicationConfig, CSP_NONCE, DOCUMENT, isDevMode, provideStabilityDebugging } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './features/app-routing.module';
import { HttpRequestInterceptor } from './core/interceptor/http-request-interceptor';
import { LoadingInterceptor } from './core/interceptor/loading.interceptor';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { importProvidersFrom, inject } from '@angular/core';
import { GlobalService } from './core/services/global.service';
import { TranslateHttpLoader } from './core/utils/loaders/translate-http-loader';
import { LanguageInterceptor } from './core/interceptor/language-interceptor';

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
    importProvidersFrom(
      MatNativeDateModule,
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
      withFetch(),
      withInterceptors([
        HttpRequestInterceptor,
        LoadingInterceptor,
        LanguageInterceptor])
    ),
    provideClientHydration(withEventReplay()),
    {
      provide: CSP_NONCE,
      useFactory: () => {
        const doc = inject(DOCUMENT);
        return doc?.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? null;
      }
    }
  ],
};
