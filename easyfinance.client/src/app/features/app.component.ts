import { Component } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavBarComponent } from '../core/components/nav-bar/nav-bar.component';
import { SpinnerComponent } from '../core/components/spinner/spinner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NavBarComponent,
    SpinnerComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(public authService: AuthService) { }
}
