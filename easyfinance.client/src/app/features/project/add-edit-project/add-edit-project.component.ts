import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { compare } from 'fast-json-patch';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../../../core/services/project.service';
import { ProjectDto } from '../models/project-dto';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { CurrencyService } from '../../../core/services/currency.service';

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
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './add-edit-project.component.html',
  styleUrl: './add-edit-project.component.css'
})
export class AddEditProjectComponent implements OnInit {
  projectForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };
  editingProject!: ProjectDto;

  constructor(
    private projectService: ProjectService,
    private currencyService: CurrencyService,
    private router: Router,
    private errorMessageService: ErrorMessageService) { }

  ngOnInit(): void {
    this.editingProject = this.projectService.getEditingProject();
    this.projectService.setEditingProject(new ProjectDto());

    this.projectForm = new FormGroup({
      name: new FormControl(this.editingProject.name ?? '', [Validators.required]),
      preferredCurrency: new FormControl(this.editingProject.preferredCurrency ?? '', [Validators.required]),
    });
  }

  saveProject() {
    if (this.projectForm.valid) {
      const name = this.name?.value;
      const preferredCurrency = this.preferredCurrency?.value;

      const newProject = <ProjectDto>({
        id: this.editingProject.id ?? '',
        name: name,
        preferredCurrency: preferredCurrency
      });

      if (this.editingProject.id) {
        this.updateProjectName(newProject);
      } else {
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

  updateProjectName(newProject: ProjectDto) {
    const patch = compare(this.editingProject, newProject);

    if (patch.length > 0) {
      this.projectService.updateProject(this.editingProject.id, patch).subscribe({
        next: response => {
          this.editingProject.name = response.name;
          this.editingProject.preferredCurrency = response.preferredCurrency;
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

  getCurrencies(): string[] {
    return this.currencyService.getAvailableCurrencies();
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.projectForm, fieldName);
  }

  get name() {
    return this.projectForm.get('name');
  }

  get preferredCurrency() {
    return this.projectForm.get('preferredCurrency');
  }
}
