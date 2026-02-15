import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-logout',
  standalone: true,
  template: ''
})
export class LogoutComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId))
      this.authService.signOut();

    this.router.navigate(['/']);
  }
}
