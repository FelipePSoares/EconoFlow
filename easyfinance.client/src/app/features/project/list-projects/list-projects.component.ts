import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
import { faPlus, faEllipsis } from '@fortawesome/free-solid-svg-icons';
import { UserService } from 'src/app/core/services/user.service';
import { MatDialog } from '@angular/material/dialog';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';

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
  private projects: BehaviorSubject<ProjectDto[]> = new BehaviorSubject<ProjectDto[]>([new ProjectDto()]);
  projects$: Observable<ProjectDto[]> = this.projects.asObservable();
  faPlus = faPlus;
  faEllipsis = faEllipsis;
  defaultProjectId$: Observable<string>;

  constructor(public projectService: ProjectService, private userService: UserService, private dialog: MatDialog, private router: Router) {
    this.defaultProjectId$ = userService.loggedUser$.pipe(map(user => user.defaultProjectId));
  }

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects() {
    this.projectService.getProjects()
      .pipe(map(projects => mapper.mapArray(projects, Project, ProjectDto)))
      .subscribe(
        {
          next: res => {
            this.projects.next(res);
          }
        });
  }

  add(): void {
    this.router.navigate([{ outlets: { modal: ['add-edit-project'] } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: 'input',
      data: {
        title: 'Create Project'
      }
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.loadProjects();
      }
    });
  }

  managePermission(project: ProjectDto) {
    this.router.navigate([{ outlets: { modal: ['projects', project.id, 'users'] } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: 'input',
      data: {
        title: 'Manage Permission'
      }
    }).afterClosed().subscribe();
  }

  select(project: ProjectDto): void {
    this.projectService.selectProject(project);

    this.router.navigate(['/projects', project.id]);
  }

  edit(project: ProjectDto): void {
    this.projectService.setEditingProject(project);
    this.router.navigate([{ outlets: { modal: ['add-edit-project'] } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: 'input',
      data: {
        title: 'Edit Project'
      }
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.loadProjects();
      }
    });
  }

  setAsDefault(project: ProjectDto) {
    this.userService.setDefaultProject(project.id).subscribe();
  }
}
