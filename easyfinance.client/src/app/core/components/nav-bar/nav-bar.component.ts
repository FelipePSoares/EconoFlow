import { Component, Input, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Observable, map } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-nav-bar',
    imports: [AsyncPipe, RouterLink],
    templateUrl: './nav-bar.component.html',
    styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent implements OnInit {
  initials$: Observable<string>;
  firstName$: Observable<string>;
  lastName$: Observable<string>;

  constructor(public userService: UserService) {
    this.firstName$ = userService.loggedUser$.pipe(map(user => user.firstName));
    this.lastName$ = userService.loggedUser$.pipe(map(user => user.lastName));
    this.initials$ = userService.loggedUser$.pipe(map(user => user.firstName[0] + user.lastName[0]));
  }

  ngOnInit(): void {
  }
}
