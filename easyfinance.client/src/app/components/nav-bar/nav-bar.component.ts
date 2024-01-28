import { Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../../Identity/auth.service';

@Component({
  selector: 'app-nav-bar',
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent implements OnInit {

  @Input()
  isSignedIn$: Observable<boolean> | undefined;
  
  constructor(private authService: AuthService) {

  }

  ngOnInit(): void {
    this.isSignedIn$ = this.authService.isSignedIn();
  }
}
