import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, RenderMode, ServerRoute, withRoutes } from '@angular/ssr';
import { TranslateLoader } from '@ngx-translate/core';
import { appConfig } from './app.config';
import { TranslateServerLoader } from './core/utils/loaders/translate-server-loader';

const serverRoutes: ServerRoute[] = [
  {
    path: 'projects/**',
    renderMode: RenderMode.Client
  },
  {
    path: 'user/**',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: TranslateLoader, useClass: TranslateServerLoader }
  ],
};

export const serverAppConfig = mergeApplicationConfig(appConfig, serverConfig);
