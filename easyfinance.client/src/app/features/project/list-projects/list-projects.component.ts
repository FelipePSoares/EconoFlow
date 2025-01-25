import { Component, OnInit, ViewChild } from '@angular/core';
import { ProjectService } from '../../../core/services/project.service';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { ProjectDto } from '../models/project-dto';
import { mapper } from 'src/app/core/utils/mappings/mapper';
import { Project } from 'src/app/core/models/project';
import { Router } from '@angular/router';
import { AsyncPipe, CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { MatGridListModule } from '@angular/material/grid-list';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

@Component({
    selector: 'app-list-projects',
    imports: [
        CommonModule,
        AsyncPipe,
        MatGridListModule,
        FontAwesomeModule,
    ],
    templateUrl: './list-projects.component.html',
    styleUrl: './list-projects.component.css'
})
export class ListProjectsComponent implements OnInit {
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;
  static firstAccess = true;
  private projects: BehaviorSubject<ProjectDto[]> = new BehaviorSubject<ProjectDto[]>([new ProjectDto()]);
  projects$: Observable<ProjectDto[]> = this.projects.asObservable();
  faPlus = faPlus;

  constructor(public projectService: ProjectService, private router: Router) {
  }

  ngOnInit(): void {
    this.projectService.getProjects()
      .pipe(map(projects => mapper.mapArray(projects, Project, ProjectDto)))
      .subscribe(
        {
          next: res => {
            if (ListProjectsComponent.firstAccess && res.length == 1) {
              ListProjectsComponent.firstAccess = false;
              this.select(res[0]);
            }
            this.projects.next(res);
          }
        });
  }

  add(): void {
    this.router.navigate(['/add-project']);
  }

  select(project: ProjectDto): void {
    this.projectService.selectProject(project);

    this.router.navigate(['/projects', project.id]);
  }
}
