import { Component, Input, OnInit } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { ProjectService } from '../../services/project.service';

@Component({
    selector: 'app-nav-bar',
    imports: [AsyncPipe, RouterLink],
    templateUrl: './nav-bar.component.html',
    styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent implements OnInit {
  firstName$: Observable<string>;
  lastName$: Observable<string>;
  defaultLink: string = '/projects';

  constructor(public userService: UserService, private projectService: ProjectService) {
    this.firstName$ = userService.loggedUser$.pipe(map(user => user.firstName));
    this.lastName$ = userService.loggedUser$.pipe(map(user => user.lastName));
  }

  ngOnInit(): void {
    this.projectService.selectedUserProject$.subscribe(userProject => {
      this.defaultLink = userProject?.project ? `/projects/${userProject.project.id}` : '/projects';
    });
  }
}
