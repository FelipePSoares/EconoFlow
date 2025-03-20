/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app/features/app-routing.module';
import { HttpRequestInterceptor } from './app/core/interceptor/http-request-interceptor';
import { LoadingInterceptor } from './app/core/interceptor/loading.interceptor';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { importProvidersFrom, inject, provideAppInitializer } from '@angular/core';
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
import { Transaction } from './app/core/models/transaction';
import { TransactionDto } from './app/features/project/models/transaction-dto';
import { UserProject } from './app/core/models/user-project';
import { UserProjectDto } from './app/features/project/models/user-project-dto';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from './app/core/utils/loaders/translate-http-loader';
import { Observable } from 'rxjs';

bootstrapApplication(AppComponent, {
  providers: [
    CurrencyPipe,
    DecimalPipe,
    GlobalService,
    provideAnimations(),
    provideRouter(routes, withComponentInputBinding()),
    importProvidersFrom(
      MatNativeDateModule,
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
      withInterceptors([
        HttpRequestInterceptor,
        LoadingInterceptor])
    ),
    provideAnimationsAsync(),
    provideAppInitializer(appInitializerFactory())
  ],
}).catch(err => console.error(err));

createMap(mapper, Project, ProjectDto);
createMap(mapper, Income, IncomeDto);
createMap(mapper, Category, CategoryDto);
createMap(mapper, Expense, ExpenseDto);
createMap(mapper, ExpenseItem, ExpenseItemDto);
createMap(mapper, Transaction, TransactionDto);
createMap(mapper, UserProject, UserProjectDto);

function appInitializerFactory(): () => Promise<void> {
  return async () => {
    const translate = inject(TranslateService);
    const globalService = inject(GlobalService);

    await loadAngularLocale(globalService, translate);
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
