/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/features/app.component';
import { appConfig } from './app/app.config';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [...(appConfig.providers ?? []), provideCharts(withDefaultRegisterables())]
}).catch(err => console.error(err));
