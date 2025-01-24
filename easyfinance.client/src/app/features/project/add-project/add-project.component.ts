import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectService } from '../../../core/services/project.service';
import { ProjectType, ProjectType2LabelMapping } from 'src/app/core/enums/project-type';
import { ProjectDto } from '../models/project-dto';
import { Router } from '@angular/router';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-add-project',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        ReturnButtonComponent,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule
    ],
    templateUrl: './add-project.component.html',
    styleUrl: './add-project.component.css'
})
export class AddProjectComponent implements OnInit {
  public projectType2LabelMapping = ProjectType2LabelMapping;
  public projectTypes = Object.values(ProjectType) as ProjectType[];
  projectForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };
  projectTypeSelected!: ProjectType;
  
  constructor(private projectService: ProjectService, private router: Router, private errorMessageService: ErrorMessageService) { }

  ngOnInit(): void {
    this.projectForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      type: new FormControl('', [Validators.required])
    });
  }

  saveProject(){
    if (this.projectForm.valid) {
      const name = this.projectForm.get('name')?.value;
      const type = this.projectForm.get('type')?.value;

      var newProject = <ProjectDto>({
        name: name,
        type: type
      })

      this.projectService.addProject(newProject).subscribe({
        next: response => {
          this.previous();
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.projectForm, this.errors);
        }
      });
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

  get type() {
    return this.projectForm.get('type');
  }

  previous() {
    this.router.navigate(['projects']);
  }
}
