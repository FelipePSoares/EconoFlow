import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-user-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslateModule
  ],
  templateUrl: './user-layout.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-layout.component.css'
})
export class UserLayoutComponent implements OnInit {
  private userService = inject(UserService);


  ngOnInit(): void {
    this.userService.refreshUserInfo().subscribe();
  }
}
