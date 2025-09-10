import { Component, OnInit } from '@angular/core';
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
  styleUrl: './user-layout.component.css'
})
export class UserLayoutComponent implements OnInit {
  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.userService.refreshUserInfo().subscribe();
  }
}
