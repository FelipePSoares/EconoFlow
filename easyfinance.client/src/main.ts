/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/features/app.component';
import { createMap } from '@automapper/core';
import { mapper } from './app/core/utils/mappings/mapper';

import { Project } from './app/core/models/project';
import { Income } from './app/core/models/income';
import { Category } from './app/core/models/category';
import { Expense } from './app/core/models/expense';
import { ExpenseItem } from './app/core/models/expense-item';
import { Transaction } from './app/core/models/transaction';
import { UserProject } from './app/core/models/user-project';
import { Client } from './app/core/models/client';

import { ProjectDto } from './app/features/project/models/project-dto';
import { IncomeDto } from './app/features/income/models/income-dto';
import { CategoryDto } from './app/features/category/models/category-dto';
import { ExpenseDto } from './app/features/expense/models/expense-dto';
import { ExpenseItemDto } from './app/features/expense/models/expense-item-dto';
import { TransactionDto } from './app/features/project/models/transaction-dto';
import { UserProjectDto } from './app/features/project/models/user-project-dto';
import { ClientDto } from './app/features/client/models/client-dto';

import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));

createMap(mapper, Project, ProjectDto);
createMap(mapper, Income, IncomeDto);
createMap(mapper, Category, CategoryDto);
createMap(mapper, Expense, ExpenseDto);
createMap(mapper, ExpenseItem, ExpenseItemDto);
createMap(mapper, Transaction, TransactionDto);
createMap(mapper, UserProject, UserProjectDto);
createMap(mapper, Client, ClientDto);
