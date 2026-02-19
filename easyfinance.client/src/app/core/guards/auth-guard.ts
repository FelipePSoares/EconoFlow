import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserService } from '../services/user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private userService = inject(UserService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private readonly bypassUrls: string[] = ["/first-signin", "/logout"];

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    if (!isPlatformBrowser(this.platformId)) {
      return true;
    }

    return this.userService.loggedUser$.pipe(
      map((user) => {
        if (!user?.enabled) {
          this.router.navigate(['login'], { queryParams: { returnUrl: state.url } });
          return false;
        }

        return this.handleUserRedirect(user, state.url);
      }),
      catchError(() => {
        this.router.navigate(['login'], { queryParams: { returnUrl: state.url } });
        return of(false);
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
