import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, RenderMode, ServerRoute, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';

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
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const serverAppConfig = mergeApplicationConfig(appConfig, serverConfig);
