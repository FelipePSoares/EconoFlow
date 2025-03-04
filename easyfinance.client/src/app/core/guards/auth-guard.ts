import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private urls: string[] = ["/first-signin", "/logout"];

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.authService.isSignedIn$.pipe(
      switchMap((isSignedIn) => {
        if (!isSignedIn) {
          this.router.navigate(['login'], { queryParams: { returnUrl: state.url } });
          return of(false);
        }

        return this.userService.loggedUser$.pipe(
          map((user) => {
            if (user.isFirstLogin && this.urls.indexOf(state.url) == -1) {
              this.router.navigate(['first-signin']);
              return false;
            }

            if (!sessionStorage.getItem("visited")) {
              sessionStorage.setItem("visited", "true");
              this.router.navigate(['/projects', user.defaultProjectId]);
              return false;
            }

            return true;
          }));
      }));
  }
}
