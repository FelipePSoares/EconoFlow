import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectService } from '../../../core/services/project.service';
import { ProjectDto } from '../models/project-dto';
import { Router } from '@angular/router';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { compare } from 'fast-json-patch';

@Component({
    selector: 'app-add-edit-project',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule
    ],
    templateUrl: './add-edit-project.component.html',
    styleUrl: './add-edit-project.component.css'
})
export class AddEditProjectComponent implements OnInit {
  projectForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };
  editingProject!: ProjectDto;

  constructor(private projectService: ProjectService, private router: Router, private errorMessageService: ErrorMessageService) { }

  ngOnInit(): void {
    this.editingProject = this.projectService.getEditingProject();
    this.projectService.setEditingProject(new ProjectDto());

    this.projectForm = new FormGroup({
      name: new FormControl(this.editingProject.name ?? '', [Validators.required])
    });
  }

  saveProject(){
    if (this.editingProject.id) {
      this.updateProjectName();
    } else {
      if (this.projectForm.valid) {
        const name = this.name?.value;

        var newProject = <ProjectDto>({
          name: name
        })

        this.projectService.addProject(newProject).subscribe({
          next: response => {
            this.router.navigate([{ outlets: { modal: null } }]);
          },
          error: (response: ApiErrorResponse) => {
            this.httpErrors = true;
            this.errors = response.errors;

            this.errorMessageService.setFormErrors(this.projectForm, this.errors);
          }
        });
      }
    }
  }

  updateProjectName() {
    if (this.projectForm.valid) {
      const name = this.name?.value;

      const newProject = <ProjectDto>({
        id: this.editingProject.id,
        name: name
      });
      const patch = compare(this.editingProject, newProject);

      if (patch.length > 0) {
        this.projectService.updateProject(this.editingProject.id, patch).subscribe({
          next: response => {
            this.editingProject.name = response.name;
            this.router.navigate([{ outlets: { modal: null } }]);
          },
          error: (response: ApiErrorResponse) => {
            this.httpErrors = true;
            this.errors = response.errors;

            this.errorMessageService.setFormErrors(this.projectForm, this.errors);
          }
        });
      } else {
        this.router.navigate([{ outlets: { modal: null } }]);
      }
    }

  }

  getFormFieldErrors(fieldName: string): string[] {
    const control = this.projectForm.get(fieldName);
    const errors: string[] = [];

    if (control && control.errors) {
      for (const key in control.errors) {
        if (control.errors.hasOwnProperty(key)) {
          switch (key) {
            case 'required':
              errors.push('This field is required.');
              break;
            default:
              errors.push(control.errors[key]);
          }
        }
      }
    }

    return errors;
  }

  get name() {
    return this.projectForm.get('name');
  }
}
