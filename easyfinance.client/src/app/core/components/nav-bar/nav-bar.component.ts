import { Component } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../services/user.service';
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project';
import { NotificationsComponent } from '../notifications/notifications.component';
import { StickyNotificationsComponent } from '../sticky-notifications/sticky-notifications.component';
import { PrivacyModeService } from '../../services/privacy-mode.service';
import { PwaInstallService } from '../../services/pwa-install.service';
import { FeatureFlag } from '../../enums/feature-flag';

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
  privacyModeEnabled$ = this.privacyModeService.isEnabled$;
  canInstall$: Observable<boolean>;

  constructor(
    public userService: UserService,
    private projectService: ProjectService,
    private router: Router,
    private privacyModeService: PrivacyModeService,
    private pwaInstallService: PwaInstallService
  ) {
    this.fullName$ = userService.loggedUser$.pipe(map(user => user.fullName));
    this.selectedProject$ = projectService.selectedUserProject$.pipe(map(up => up?.project));
    this.logoLink$ = this.selectedProject$.pipe(
      map(project => project?.id ? ['/projects', project.id] : ['/projects'])
    );
    const hasPwaInstallFeature$ = this.userService.loggedUser$.pipe(
      map(user => user?.enabledFeatures?.includes(FeatureFlag.PwaInstall) ?? false)
    );
    this.canInstall$ = combineLatest([this.pwaInstallService.canInstall$, hasPwaInstallFeature$]).pipe(
      map(([canInstall, hasPwaInstallFeature]) => canInstall && hasPwaInstallFeature)
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

  togglePrivacyMode(): void {
    this.privacyModeService.toggle();
  }

  installApp(): void {
    void this.pwaInstallService.promptInstall();
  }
}
