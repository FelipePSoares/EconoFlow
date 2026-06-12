import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-logout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: ''
})
export class LogoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  private platformId = inject(PLATFORM_ID);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId))
      this.authService.signOut();

    this.router.navigate(['/']);
  }
}
