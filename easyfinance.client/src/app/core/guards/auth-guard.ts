import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Observable, map } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.isSignedIn(state);
  }
  
  isSignedIn(state: RouterStateSnapshot): Observable<boolean> {
    return this.authService.isSignedIn$.pipe(
      map((isSignedIn) => {
        if (!isSignedIn) {
          this.router.navigate(['login'], { queryParams: { returnUrl: state.url } });
          return false;
        }

        return true;
      }));
  }
}
