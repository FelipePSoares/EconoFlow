import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectService } from '../../../core/services/project.service';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { ProjectDto } from '../models/project-dto';
import { mapper } from 'src/app/core/utils/mappings/mapper';
import { Project } from 'src/app/core/models/project';
import { compare } from 'fast-json-patch';
import { Router } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faBoxArchive, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-list-projects',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, AsyncPipe, AddButtonComponent, FontAwesomeModule],
  templateUrl: './list-projects.component.html',
  styleUrls: ['./list-projects.component.css', '../../styles/shared.scss']
})
export class ListProjectsComponent implements OnInit {
  faPenToSquare = faPenToSquare;
  faBoxArchive = faBoxArchive;
  faFloppyDisk = faFloppyDisk;
  static firstAccess = true;
  private projects: BehaviorSubject<ProjectDto[]> = new BehaviorSubject<ProjectDto[]>([new ProjectDto()]);
  projects$: Observable<ProjectDto[]> = this.projects.asObservable();
  projectForm!: FormGroup;
  editingProject: ProjectDto = new ProjectDto();
  httpErrors = false;
  errors: any;

  constructor(public projectService: ProjectService, private router: Router)
  {
    this.edit(new Project());
  }

  ngOnInit(): void {
    this.projectService.getProjects()
      .pipe(map(projects => mapper.mapArray(projects, Project, ProjectDto)))
      .subscribe(
        {
          next: res => {
            if (ListProjectsComponent.firstAccess && res.length == 1) {
              ListProjectsComponent.firstAccess = false;
              this.select(res[0].id);
            }
            this.projects.next(res);
          }
        });
  }

  get name() {
    return this.projectForm.get('name');
  }

  add(): void {
    this.router.navigate(['/add-project']);
  }

  select(id: string): void {
    this.router.navigate(['/projects', id]);
  }

  save(): void {
    if (this.projectForm.valid) {
      const id = this.projectForm.get('id')?.value;
      const name = this.projectForm.get('name')?.value;
      const type = this.projectForm.get('type')?.value;

      var newProject = <ProjectDto>({
        id: id,
        name: name,
        type: type
      })
      var patch = compare(this.editingProject, newProject);

      this.projectService.updateProject(id, patch).subscribe({
        next: response => {
          this.editingProject.name = response.name;
          this.editingProject = new Project();
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
        }
      });
    }
  }
  
  edit(project: ProjectDto): void {
    this.editingProject = project;
    this.projectForm = new FormGroup({
      id: new FormControl(project.id),
      name: new FormControl(project.name, [Validators.required]),
      type: new FormControl(project.type)
    });
  }

  cancelEdit(): void {
    this.editingProject = new ProjectDto();
  }

  remove(id: string): void{
    this.projectService.removeProject(id).subscribe({
      next: response => {
        const projectsNewArray: ProjectDto[] = this.projects.getValue();

        projectsNewArray.forEach((item, index) => {
          if (item.id === id) { projectsNewArray.splice(index, 1); }
        });

        this.projects.next(projectsNewArray);
      }
    })
  }
}
