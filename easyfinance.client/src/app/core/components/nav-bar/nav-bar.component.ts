import { Component } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../services/user.service';
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project';
import { NotificationsComponent } from '../notifications/notifications.component';
import { StickyNotificationsComponent } from '../sticky-notifications/sticky-notifications.component';

@Component({
  selector: 'app-nav-bar',
  imports: [
    AsyncPipe,
    RouterLink,
    TranslateModule,
    RouterLinkActive,
    NotificationsComponent,
    StickyNotificationsComponent
  ],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent {
  fullName$: Observable<string>;
  selectedProject$: Observable<Project | undefined>;
  readonly logoLink$: Observable<string[]>;

  constructor(
    public userService: UserService,
    private projectService: ProjectService,
    private router: Router
  ) {
    this.fullName$ = userService.loggedUser$.pipe(map(user => user.fullName));
    this.selectedProject$ = projectService.selectedUserProject$.pipe(map(up => up?.project));
    this.logoLink$ = this.selectedProject$.pipe(
      map(project => project?.id ? ['/projects', project.id] : ['/projects'])
    );
  }

  isProjectOverviewActive(projectId: string | undefined): boolean {
    if (!projectId) {
      return false;
    }

    const currentPath = this.router.url.split('?')[0].split('#')[0];
    const projectRoot = `/projects/${projectId}`;
    const projectOverviewRoot = `${projectRoot}/overview`;

    return currentPath === projectRoot || currentPath === projectOverviewRoot || currentPath.startsWith(`${projectOverviewRoot}/`);
  }
}
