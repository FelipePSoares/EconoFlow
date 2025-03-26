import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/features/app.component';
import { provideServerRendering } from '@angular/platform-server';

const bootstrap = () => bootstrapApplication(AppComponent, {
    providers: [
      provideServerRendering(),
    ]
  });

export default bootstrap;
