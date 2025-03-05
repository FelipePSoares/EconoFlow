import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { map, of, switchMap, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
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
        console.log(`url: ${state.url}`);
        console.log(`user: ${JSON.stringify(user)}`);

        if (!user?.enabled) {
          this.router.navigate(['login'], { queryParams: { returnUrl: state.url } });
          return false;
        }

        return this.handleUserRedirect(user, state.url);
      })
    );
  }

  private handleUserRedirect(user: any, currentUrl: string): boolean {
    if (user.isFirstLogin && !this.bypassUrls.includes(currentUrl)) {
      this.router.navigate(['first-signin']);
      return false;
    }

    if (!sessionStorage.getItem("visited")) {
      sessionStorage.setItem("visited", "true");
      this.router.navigate(['/projects', user.defaultProjectId]);
      return false;
    }

    return true;
  }
}
