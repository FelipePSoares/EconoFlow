import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/features/app.component';
import { provideServerRendering } from '@angular/platform-server';
import { CSP_NONCE, importProvidersFrom } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { TranslateHttpLoader } from './app/core/utils/loaders/translate-http-loader';
import { LoadingInterceptor } from './app/core/interceptor/loading.interceptor';

function getCspNonce(): string | null {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]');
  return meta?.content ?? null;
}

const nonce = getCspNonce();
console.log("CSP Nonce:", nonce);

const bootstrap = () => bootstrapApplication(AppComponent, {
  providers: [
    provideServerRendering(),
    importProvidersFrom(
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
      withInterceptors([LoadingInterceptor])
    ),
    { provide: CSP_NONCE, useValue: nonce }
  ]
});

export default bootstrap;
