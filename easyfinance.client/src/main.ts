/// <reference types="@angular/localize" />

import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/features/app.module';
import { createMap } from '@automapper/core';
import { mapper } from './app/core/utils/mappings/mapper';
import { Project } from './app/core/models/project';
import { ProjectDto } from './app/features/project/models/project-dto';

platformBrowserDynamic().bootstrapModule(AppModule)
.catch(err => console.error(err));

createMap(mapper, Project, ProjectDto);