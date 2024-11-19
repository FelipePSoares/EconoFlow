/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app/features/app-routing.module';
import { HttpRequestInterceptor } from './app/core/interceptor/http-request-interceptor';
import { LoadingInterceptor } from './app/core/interceptor/loading.interceptor';
import { CurrencyPipe } from '@angular/common';
import { APP_INITIALIZER } from '@angular/core';
import { loadAngularLocale } from './app/core/utils/loaders/angular-locale-loader';
import { loadMomentLocale } from './app/core/utils/loaders/moment-locale-loader';

import { AppComponent } from './app/features/app.component';
import { createMap } from '@automapper/core';
import { mapper } from './app/core/utils/mappings/mapper';

import { Project } from './app/core/models/project';
import { Income } from './app/core/models/income';
import { Category } from './app/core/models/category';
import { Expense } from './app/core/models/expense';
import { ExpenseItem } from './app/core/models/expense-item';

import { ProjectDto } from './app/features/project/models/project-dto';
import { IncomeDto } from './app/features/income/models/income-dto';
import { CategoryDto } from './app/features/category/models/category-dto';
import { ExpenseDto } from './app/features/expense/models/expense-dto';
import { ExpenseItemDto } from './app/features/expense/models/expense-item-dto';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';


bootstrapApplication(AppComponent, {
  providers: [
    CurrencyPipe,
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializerFactory,
      multi: true
    },
    provideAnimations(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([HttpRequestInterceptor, LoadingInterceptor])), provideAnimationsAsync()],
});

createMap(mapper, Project, ProjectDto);
createMap(mapper, Income, IncomeDto);
createMap(mapper, Category, CategoryDto);
createMap(mapper, Expense, ExpenseDto);
createMap(mapper, ExpenseItem, ExpenseItemDto);

function appInitializerFactory(): () => Promise<void> {
  return async () => {
    const browserLang = navigator.language || 'en-US';
    await loadAngularLocale(browserLang);
    await loadMomentLocale(browserLang);
  };
}
