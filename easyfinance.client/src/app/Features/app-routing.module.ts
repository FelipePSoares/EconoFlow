import { Routes, mapToCanActivate } from '@angular/router';
import { FirstSignInGuard } from '../core/guards/first-sign-in-guard';
import { AuthGuard } from '../core/guards/auth-guard';
import { LoginComponent } from './authentication/login/login.component';
import { RegisterComponent } from './authentication/register/register.component';
import { LogoutComponent } from './authentication/logout/logout.component';
import { FirstSignInComponent } from './authentication/first-sign-in/first-sign-in.component';
import { ListProjectsComponent } from './project/list-projects/list-projects.component';
import { AddProjectComponent } from './project/add-project/add-project.component';
import { ListIncomesComponent } from './income/list-incomes/list-incomes.component';
import { AddIncomeComponent } from './income/add-income/add-income.component';
import { DetailProjectComponent } from './project/detail-project/detail-project.component';

export const routes: Routes = [
  { path: '', redirectTo: 'projects', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'logout', component: LogoutComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'first-signin', component: FirstSignInComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'add-project', component: AddProjectComponent, canActivate: mapToCanActivate([AuthGuard, FirstSignInGuard]) },
  { path: 'projects', component: ListProjectsComponent, canActivate: mapToCanActivate([AuthGuard, FirstSignInGuard]) },
  { path: 'projects/:projectId', component: DetailProjectComponent, canActivate: mapToCanActivate([AuthGuard, FirstSignInGuard]) },
  { path: 'projects/:projectId/incomes', component: ListIncomesComponent, canActivate: mapToCanActivate([AuthGuard, FirstSignInGuard]) },
  { path: 'projects/:projectId/add-income', component: AddIncomeComponent, canActivate: mapToCanActivate([AuthGuard, FirstSignInGuard]) },
];
