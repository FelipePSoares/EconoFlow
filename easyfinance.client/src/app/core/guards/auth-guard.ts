import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(
    private authService: AuthService,
    private router: Router) { }

  canActivate() {
    return this.isSignedIn();
  }
  
  isSignedIn(): Observable<boolean> {
    return this.authService.isSignedIn$.pipe(
      map((isSignedIn) => {
        if (!isSignedIn) {
          this.router.navigate(['login']);
          return false;
        }

        return true;
      }));
  }
}
