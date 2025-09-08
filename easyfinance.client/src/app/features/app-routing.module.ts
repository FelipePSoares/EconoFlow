import { Routes, mapToCanActivate } from '@angular/router';
import { AuthGuard } from '../core/guards/auth-guard';

import { IndexComponent } from './not-authenticated-area/index/index.component';
import { PrivacyPolicyComponent } from './not-authenticated-area/privacy-policy/privacy-policy.component';
import { UseTermsComponent } from './not-authenticated-area/use-terms/use-terms.component';
import { ContactUsComponent } from './not-authenticated-area/contact-us/contact-us.component';
import { HowToComponent } from './not-authenticated-area/how-to/how-to.component';

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
import { SmartSetupComponent } from './project/smart-setup/smart-setup.component';

import { ListIncomesComponent } from './income/list-incomes/list-incomes.component';
import { AddIncomeComponent } from './income/add-income/add-income.component';

import { ListCategoriesComponent } from './category/list-categories/list-categories.component';
import { AddCategoryComponent } from './category/add-category/add-category.component';

import { AddExpenseComponent } from './expense/add-expense/add-expense.component';
import { AddExpenseItemComponent } from './expense/add-expense-item/add-expense-item.component';
import { ListExpensesComponent } from './expense/list-expenses/list-expenses.component';

import { UserLayoutComponent } from './user/user-layout/user-layout.component';
import { AccountComponent } from './user/account/account.component';
import { PasswordAuthenticationComponent } from './user/password-authentication/password-authentication.component';

export const routes: Routes = [
  { path: '', component: IndexComponent, pathMatch: 'full' },
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  { path: 'use-terms', component: UseTermsComponent },
  { path: 'contact-us', component: ContactUsComponent },
  { path: 'login', component: LoginComponent },
  { path: 'recovery', component: RecoveryComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'how-to-create-budget', component: HowToComponent, data: { content: 'create-budget' } },
  { path: 'logout', component: LogoutComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'first-signin', component: FirstSignInComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'add-edit-project', component: AddEditProjectComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal', data: { title: 'CreateEditProject' } },
  { path: 'projects', component: ListProjectsComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId', component: DetailProjectComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId/smart-setup', component: SmartSetupComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal', data: { title: 'SmartSetup', hasCloseButton: false } },
  { path: 'projects/:projectId/users', component: AccessControlProjectComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal', data: { title: 'ManageAccess' } },
  { path: 'projects/:token/accept', component: AcceptInviteComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId/incomes', component: ListIncomesComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId/add-income', component: AddIncomeComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal', data: { title: 'CreateIncome' } },
  { path: 'projects/:projectId/categories', component: ListCategoriesComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal', data: { title: 'ListCategories' } },
  { path: 'projects/:projectId/add-category', component: AddCategoryComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal', data: { title: 'CreateExpenseCategory' } },
  { path: 'projects/:projectId/categories/:categoryId/add-expense', component: AddExpenseComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal', data: { title: 'CreateExpense' } },
  { path: 'projects/:projectId/categories/:categoryId/expenses', component: ListExpensesComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'projects/:projectId/categories/:categoryId/expenses/:expenseId/add-expense-item', component: AddExpenseItemComponent, canActivate: mapToCanActivate([AuthGuard]), outlet: 'modal', data: { title: 'CreateExpense' } },
  {
    path: 'user',
    component: UserLayoutComponent,
    children: [
      { path: 'account', component: AccountComponent },
      { path: 'authentication', component: PasswordAuthenticationComponent },
      { path: 'emails', component: UseTermsComponent },
      { path: '', redirectTo: 'account', pathMatch: 'full' }
    ],
    canActivate: mapToCanActivate([AuthGuard])
  },
  { path: '**', redirectTo: 'projects' },
];
