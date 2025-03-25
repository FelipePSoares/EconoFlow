import { ApplicationConfig, PLATFORM_ID } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './features/app-routing.module';
import { HttpRequestInterceptor } from './core/interceptor/http-request-interceptor';
import { LoadingInterceptor } from './core/interceptor/loading.interceptor';
import { CurrencyPipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { importProvidersFrom, inject, provideAppInitializer } from '@angular/core';
import { loadAngularLocale } from './core/utils/loaders/angular-locale-loader';
import { loadMomentLocale } from './core/utils/loaders/moment-locale-loader';
import { GlobalService } from './core/services/global.service';
import { TranslateHttpLoader } from './core/utils/loaders/translate-http-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    CurrencyPipe,
    DecimalPipe,
    GlobalService,
    provideAnimations(),
    provideRouter(routes, withComponentInputBinding()),
    importProvidersFrom(
      MatNativeDateModule,
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: (http: HttpClient) => new TranslateHttpLoader(http),
          deps: [HttpClient]
        },
        defaultLanguage: 'en'
      })
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([
        HttpRequestInterceptor,
        LoadingInterceptor])
    ),
    provideAnimationsAsync(),
    provideAppInitializer(appInitializerFactory()), provideClientHydration(withEventReplay())
  ],
};

function appInitializerFactory(): () => Promise<void> {
  return async () => {
    const translate = inject(TranslateService);
    const globalService = inject(GlobalService);
    const platformId = inject(PLATFORM_ID);

    if (isPlatformBrowser(platformId)) {
      await loadAngularLocale(globalService, translate);
      await loadMomentLocale(globalService.languageLoaded);
    }

    const formatter = new Intl.NumberFormat(globalService.languageLoaded);
    const parts = formatter.formatToParts(1234.5);

    globalService.decimalSeparator = parts.find(part => part.type === 'decimal')?.value || globalService.decimalSeparator;

    const groupSeparator = parts.find(part => part.type === 'group')?.value || '';

    if (['.', ','].includes(groupSeparator)) {
      globalService.groupSeparator = groupSeparator;
    } else {
      globalService.groupSeparator = globalService.decimalSeparator === '.' ? ',' : '.';
    }
  };
}
