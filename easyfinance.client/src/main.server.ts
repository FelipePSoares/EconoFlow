import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/features/app.component';
import { serverAppConfig } from './app/app.config.server';

export default (context: BootstrapContext) =>
  bootstrapApplication(AppComponent, serverAppConfig, context);
