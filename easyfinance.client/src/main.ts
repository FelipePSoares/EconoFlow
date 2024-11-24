/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app/features/app-routing.module';
import { HttpRequestInterceptor } from './app/core/interceptor/http-request-interceptor';
import { LoadingInterceptor } from './app/core/interceptor/loading.interceptor';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { APP_INITIALIZER } from '@angular/core';
import { loadAngularLocale } from './app/core/utils/loaders/angular-locale-loader';
import { loadMomentLocale } from './app/core/utils/loaders/moment-locale-loader';
import { GlobalService } from './app/core/services/global.service';

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
    DecimalPipe,
    {
      provide: APP_INITIALIZER,
      deps: [GlobalService],
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

function appInitializerFactory(globalService: GlobalService): () => Promise<void> {
  return async () => {
    await loadAngularLocale(globalService);
    await loadMomentLocale(globalService.languageLoaded);

    const formatter = new Intl.NumberFormat(globalService.languageLoaded);
    const parts = formatter.formatToParts(1234.5);

    globalService.decimalSeparator = parts.find(part => part.type === 'decimal')?.value || globalService.decimalSeparator;

    const groupSeparator = parts.find(part => part.type === 'group')?.value || '';

    if (['.', ','].includes(groupSeparator)) {
      globalService.groupSeparator = groupSeparator;
    } else {
      globalService.groupSeparator = globalService.decimalSeparator === '.' ? ',' : '.';
    }
  };
}
