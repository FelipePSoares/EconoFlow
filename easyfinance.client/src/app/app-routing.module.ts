import { NgModule } from '@angular/core';
import { RouterModule, Routes, mapToCanActivate } from '@angular/router';
import { AuthGuard } from './Identity/AuthGuard';
import { ForecastComponent } from './Features/Forecast/forecast.component';
import { LoginComponent } from './Features/Login/login.component';
import { RegisterComponent } from './Features/Register/register.component';

const routes: Routes = [
  { path: '', redirectTo: '/', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'logout', component: RegisterComponent, canActivate: mapToCanActivate([AuthGuard]) },
  { path: 'forecast', component: ForecastComponent, canActivate: mapToCanActivate([AuthGuard]) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
