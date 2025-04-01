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
import { TranslateModule } from '@ngx-translate/core';
import confetti from 'canvas-confetti';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ProjectService } from '../../../core/services/project.service';
import { ProjectDto } from '../models/project-dto';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { ProjectTypes } from '../../../core/enums/project-types';
import { UserService } from '../../../core/services/user.service';
import { SubscriptionLevel } from '../../../core/enums/subscription-level';

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
    TranslateModule,
    MatSlideToggleModule
  ],
  templateUrl: './add-edit-project.component.html',
  styleUrl: './add-edit-project.component.css'
})
export class AddEditProjectComponent implements OnInit {
  projectForm!: FormGroup;
  httpErrors = false;
  errors!: Record<string, string[]>;
  editingProject!: ProjectDto;
  hasAccessToCompanyProjects = false;

  constructor(
    private dialogRef: MatDialogRef<PageModalComponent>,
    private projectService: ProjectService,
    private currencyService: CurrencyService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    this.userService.loggedUser$.subscribe(user => {
      this.hasAccessToCompanyProjects = user.subscriptionLevel >= SubscriptionLevel.Enterprise;
    });
    this.editingProject = this.projectService.getEditingProject();
    this.projectService.setEditingProject(new ProjectDto());
    const projectType = this.editingProject?.type ?? ProjectTypes.Personal;

    this.projectForm = new FormGroup({
      name: new FormControl(this.editingProject.name ?? '', [Validators.required]),
      preferredCurrency: new FormControl(this.editingProject.preferredCurrency ?? '', [Validators.required]),
      type: new FormControl(projectType == ProjectTypes.Company)
    });
  }

  saveProject() {
    if (this.projectForm.valid) {
      const name = this.name?.value;
      const preferredCurrency = this.preferredCurrency?.value;
      const type = this.type?.value ? ProjectTypes.Company : ProjectTypes.Personal;

      const newProject = ({
        id: this.editingProject.id ?? '',
        name: name,
        preferredCurrency: preferredCurrency,
        type: type
      }) as ProjectDto;

      if (this.editingProject.id) {
        this.updateProjectName(newProject);
      } else {
        this.projectService.addProject(newProject).subscribe({
          next: response => {
            const userProject = response.body;

            if (userProject) {
              if (response.status == 201) {
                this.projectService.selectUserProject(userProject);
                this.celebrate();
                this.router.navigate([{ outlets: { modal: ['projects', userProject.project.id, 'smart-setup'] } }]);
              } else {
                this.dialogRef.close();
                this.router.navigate(['projects', userProject.project.id]);
              }
            }
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

  get type() {
    return this.projectForm.get('type');
  }

  get name() {
    return this.projectForm.get('name');
  }

  get preferredCurrency() {
    return this.projectForm.get('preferredCurrency');
  }

  celebrate() {
    confetti({
      particleCount: 150,
      spread: 150,
      ticks: 250,
      startVelocity: 30,
      decay: 0.95,
      origin: {
        y: 0.5
      }
    });
  }
}
