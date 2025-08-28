import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { map } from 'rxjs';
import { UserService } from '../services/user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private readonly bypassUrls: string[] = ["/first-signin", "/logout"];

  constructor(
    private userService: UserService,
    private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.userService.loggedUser$.pipe(
      map((user) => {
        if (!user?.enabled) {
          this.router.navigate(['login'], { queryParams: { returnUrl: state.url } });
          return false;
        }

        return this.handleUserRedirect(user, state.url);
      })
    );
  }

  private handleUserRedirect(user: any, currentUrl: string): boolean {
    if (user.isFirstLogin) {
      if (!this.bypassUrls.includes(currentUrl)) {
        this.router.navigate(['first-signin']);
        return false;
      }
    }

    return true;
  }
}
