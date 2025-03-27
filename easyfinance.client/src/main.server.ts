import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/features/app.component';
import { provideServerRendering } from '@angular/platform-server';
import { importProvidersFrom } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { TranslateHttpLoader } from './app/core/utils/loaders/translate-http-loader';
import { LoadingInterceptor } from './app/core/interceptor/loading.interceptor';

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
      )
    ]
  });

export default bootstrap;
