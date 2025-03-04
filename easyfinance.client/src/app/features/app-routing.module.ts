import { Routes, mapToCanActivate } from '@angular/router';
import { AuthGuard } from '../core/guards/auth-guard';

import { LoginComponent } from './authentication/login/login.component';
import { RegisterComponent } from './authentication/register/register.component';
import { LogoutComponent } from './authentication/logout/logout.component';
import { FirstSignInComponent } from './authentication/first-sign-in/first-sign-in.component';
import { RecoveryComponent } from './authentication/recovery/recovery.component';

import { ListProjectsComponent } from './project/list-projects/list-projects.component';
import { AddEditProjectComponent } from './project/add-edit-project/add-edit-project.component';
import { DetailProjectComponent } from './project/detail-project/detail-project.component';
import { AcceptInviteComponent } from '../core/components/accept-invite/accept-invite.component';
import { AccessControlProjectComponent } from './project/access-control-project/access-control-project.component';

import { ListIncomesComponent } from './income/list-incomes/list-incomes.component';
import { AddIncomeComponent } from './income/add-income/add-income.component';

import { ListCategoriesComponent } from './category/list-categories/list-categories.component';
import { AddCategoryComponent } from './category/add-category/add-category.component';

import { AddExpenseComponent } from './expense/add-expense/add-expense.component';
import { DetailExpenseComponent } from './expense/detail-expense/detail-expense.component';
import { AddExpenseItemComponent } from './expense/add-expense-item/add-expense-item.component';
import { ListExpensesComponent } from './expense/list-expenses/list-expenses.component';

import { DetailUserComponent } from './user/detail-user/detail-user.component';

export const routes: Routes = [
  { path: '', redirectTo: 'projects', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'recovery', component: RecoveryComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'logout', component: LogoutComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'first-signin', component: FirstSignInComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'user', component: DetailUserComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'add-edit-project', component: AddEditProjectComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal' },
  { path: 'projects', component: ListProjectsComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId', component: DetailProjectComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId/users', component: AccessControlProjectComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal' },
  { path: 'projects/:token/accept', component: AcceptInviteComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId/incomes', component: ListIncomesComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId/add-income', component: AddIncomeComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal' },
  { path: 'projects/:projectId/categories', component: ListCategoriesComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId/add-category', component: AddCategoryComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal' },
  { path: 'projects/:projectId/categories/:categoryId/add-expense', component: AddExpenseComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal' },
  { path: 'projects/:projectId/categories/:categoryId/expenses', component: ListExpensesComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId/categories/:categoryId/expenses/:expenseId', component: DetailExpenseComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId/categories/:categoryId/expenses/:expenseId/add-expense-item', component: AddExpenseItemComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal' },
  { path: '**', redirectTo: 'projects' },
];
