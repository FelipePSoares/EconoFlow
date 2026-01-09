/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/features/app.component';

import { appConfig } from './app/app.config';

import { config } from '@fortawesome/fontawesome-svg-core';

config.autoAddCss = true;      // keep FontAwesome CSS
config.autoReplaceSvg = false; // critical: disables JS style injection

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
