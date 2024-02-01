import { NgModule } from '@angular/core';
import { RouterModule, Routes, mapToCanActivate, mapToCanDeactivate } from '@angular/router';
import { AuthGuard } from './Identity/AuthGuard';
import { ForecastComponent } from './Features/Forecast/forecast.component';
import { LoginComponent } from './Features/Login/login.component';
import { RegisterComponent } from './Features/Register/register.component';
import { LogoutComponent } from './Features/logout/logout.component';
import { FirstSignInComponent } from './Features/first-sign-in/first-sign-in.component';
import { FirstSignInGuard } from './Features/first-sign-in/FirstSignInGuard';

const routes: Routes = [
  { path: '', redirectTo: 'forecast', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'logout', component: LogoutComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'first-signin', component: FirstSignInComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'forecast', component: ForecastComponent, canActivate: mapToCanActivate([AuthGuard, FirstSignInGuard]) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
