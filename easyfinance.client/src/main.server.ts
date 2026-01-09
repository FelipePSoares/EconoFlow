import { provideServerRendering } from '@angular/ssr';
import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/features/app.component';
import { importProvidersFrom } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { TranslateHttpLoader } from './app/core/utils/loaders/translate-http-loader';
import { LoadingInterceptor } from './app/core/interceptor/loading.interceptor';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { config } from '@fortawesome/fontawesome-svg-core';

config.autoAddCss = true;      // keep FontAwesome CSS
config.autoReplaceSvg = false; // critical: disables JS style injection

const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, {
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
    provideCharts(withDefaultRegisterables())
  ]
}, context);

export default bootstrap;
