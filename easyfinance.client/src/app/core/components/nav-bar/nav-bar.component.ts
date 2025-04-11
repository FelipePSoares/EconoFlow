import { Component, OnInit } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../services/user.service';
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project';
import { ProjectTypes } from '../../enums/project-types';

@Component({
    selector: 'app-nav-bar',
    imports: [AsyncPipe, RouterLink, TranslateModule],
    templateUrl: './nav-bar.component.html',
    styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent {
  fullName$: Observable<string>;
  selectedProject$!: Observable<Project | undefined>;
  isCompany$!: Observable<boolean>;

  constructor(public userService: UserService, private projectService: ProjectService) {
    this.fullName$ = userService.loggedUser$.pipe(map(user => user.fullName));
    this.selectedProject$ = projectService.selectedUserProject$.pipe(map(up => up?.project));
    this.isCompany$ = projectService.selectedUserProject$.pipe(map(up => up?.project.type === ProjectTypes.Company));
  }
}
