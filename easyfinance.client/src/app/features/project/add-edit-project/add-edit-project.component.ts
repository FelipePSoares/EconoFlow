import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { compare } from 'fast-json-patch';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import confetti from 'canvas-confetti';
import { MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../../core/services/project.service';
import { ProjectDto } from '../models/project-dto';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { TaxYearType } from '../../../core/enums/tax-year-type';
import { TaxYearLabeling } from '../../../core/enums/tax-year-labeling';
import { ProjectTaxYearSettings, ProjectTaxYearSettingsRequest } from '../../../core/models/project-tax-year-settings';

@Component({
  selector: 'app-add-edit-project',
  imports: [
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
  errors!: Record<string, string[]>;
  editingProject!: ProjectDto;
  taxYearTypeOptions = [
    { value: TaxYearType.CalendarYear, label: 'TaxYearTypeCalendarYear' },
    { value: TaxYearType.CustomStartMonth, label: 'TaxYearTypeCustomStartMonth' }
  ];
  taxYearLabelingOptions = [
    { value: TaxYearLabeling.ByStartYear, label: 'TaxYearLabelByStartYear' },
    { value: TaxYearLabeling.ByEndYear, label: 'TaxYearLabelByEndYear' }
  ];
  months = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Date(2001, index, 1).toLocaleString(undefined, { month: 'long' })
  }));

  constructor(
    private dialogRef: MatDialogRef<PageModalComponent>,
    private projectService: ProjectService,
    private currencyService: CurrencyService,
    private router: Router,
    private errorMessageService: ErrorMessageService
  ) { }

  ngOnInit(): void {
    this.editingProject = this.projectService.getEditingProject();
    this.projectService.setEditingProject(new ProjectDto());

    const taxYearType = this.editingProject.taxYearType ?? TaxYearType.CalendarYear;
    const taxYearStartMonth = this.editingProject.taxYearStartMonth ?? 1;
    const taxYearStartDay = this.editingProject.taxYearStartDay ?? 1;
    const taxYearLabeling = this.editingProject.taxYearLabeling ?? TaxYearLabeling.ByStartYear;

    this.projectForm = new FormGroup({
      name: new FormControl(this.editingProject.name ?? '', [Validators.required, Validators.maxLength(60)]),
      preferredCurrency: new FormControl(this.editingProject.preferredCurrency ?? '', [Validators.required]),
      taxYearType: new FormControl(taxYearType, [Validators.required]),
      taxYearStartMonth: new FormControl(taxYearStartMonth),
      taxYearStartDay: new FormControl(taxYearStartDay),
      taxYearLabeling: new FormControl(taxYearLabeling)
    });

    this.updateTaxYearControlValidation();
    this.taxYearTypeControl?.valueChanges.subscribe(() => this.updateTaxYearControlValidation());
  }

  async saveProject() {
    if (!this.projectForm.valid) {
      return;
    }

    const newProject = ({
      id: this.editingProject.id ?? '',
      name: this.name?.value,
      preferredCurrency: this.preferredCurrency?.value
    }) as ProjectDto;

    if (this.editingProject.id) {
      await this.updateProject(newProject);
      return;
    }

    try {
      const response = await firstValueFrom(this.projectService.addProject(newProject));
      const userProject = response.body;

      if (!userProject) {
        return;
      }

      const taxYearSaved = await this.saveTaxYearSettings(userProject.project.id);
      if (!taxYearSaved) {
        return;
      }

      if (response.status == 201) {
        this.projectService.selectUserProject(userProject);
        this.celebrate();
        this.router.navigate([{ outlets: { modal: ['projects', userProject.project.id, 'smart-setup'] } }]);
        return;
      }

      this.dialogRef.close();
      this.dialogRef.afterClosed().subscribe(() => {
        this.router.navigate(['/projects', userProject.project.id]);
      });
    } catch (error) {
      this.handleFormError(error as ApiErrorResponse);
    }
  }

  private async updateProject(newProject: ProjectDto): Promise<void> {
    const currentPatchModel = {
      name: this.editingProject.name,
      preferredCurrency: this.editingProject.preferredCurrency
    };
    const updatedPatchModel = {
      name: newProject.name,
      preferredCurrency: newProject.preferredCurrency
    };
    const patch = compare(currentPatchModel, updatedPatchModel);

    try {
      if (patch.length > 0) {
        const response = await firstValueFrom(this.projectService.updateProject(this.editingProject.id, patch));
        this.editingProject.name = response.name;
        this.editingProject.preferredCurrency = response.preferredCurrency;
      }

      const taxYearSaved = await this.saveTaxYearSettings(this.editingProject.id);
      if (!taxYearSaved) {
        return;
      }

      this.router.navigate([{ outlets: { modal: null } }]);
    } catch (error) {
      this.handleFormError(error as ApiErrorResponse);
    }
  }

  private async saveTaxYearSettings(projectId: string): Promise<boolean> {
    const request = this.getTaxYearSettingsRequest();

    try {
      const savedSettings = await firstValueFrom(this.projectService.upsertTaxYearSettings(projectId, request));
      this.applyTaxYearSettings(savedSettings);
      return true;
    } catch (error) {
      this.handleFormError(error as ApiErrorResponse);
      return false;
    }
  }

  private getTaxYearSettingsRequest(): ProjectTaxYearSettingsRequest {
    const taxYearType = this.taxYearTypeControl?.value as TaxYearType;

    if (taxYearType === TaxYearType.CustomStartMonth) {
      return {
        taxYearType,
        taxYearStartMonth: Number(this.taxYearStartMonthControl?.value),
        taxYearStartDay: Number(this.taxYearStartDayControl?.value || 1),
        taxYearLabeling: this.taxYearLabelingControl?.value as TaxYearLabeling
      };
    }

    return {
      taxYearType: TaxYearType.CalendarYear
    };
  }

  private applyTaxYearSettings(settings: ProjectTaxYearSettings): void {
    this.editingProject.taxYearType = settings.taxYearType;
    this.editingProject.taxYearStartMonth = settings.taxYearStartMonth;
    this.editingProject.taxYearStartDay = settings.taxYearStartDay;
    this.editingProject.taxYearLabeling = settings.taxYearLabeling;
  }

  private updateTaxYearControlValidation(): void {
    const customTaxYear = this.taxYearTypeControl?.value === TaxYearType.CustomStartMonth;

    if (customTaxYear) {
      this.taxYearStartMonthControl?.setValidators([Validators.required, Validators.min(1), Validators.max(12)]);
      this.taxYearStartDayControl?.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
      this.taxYearLabelingControl?.setValidators([Validators.required]);

      if (!this.taxYearStartMonthControl?.value) {
        this.taxYearStartMonthControl?.setValue(1, { emitEvent: false });
      }

      if (!this.taxYearStartDayControl?.value) {
        this.taxYearStartDayControl?.setValue(1, { emitEvent: false });
      }

      if (!this.taxYearLabelingControl?.value) {
        this.taxYearLabelingControl?.setValue(TaxYearLabeling.ByStartYear, { emitEvent: false });
      }
    } else {
      this.taxYearStartMonthControl?.clearValidators();
      this.taxYearStartDayControl?.clearValidators();
      this.taxYearLabelingControl?.clearValidators();
    }

    this.taxYearStartMonthControl?.updateValueAndValidity({ emitEvent: false });
    this.taxYearStartDayControl?.updateValueAndValidity({ emitEvent: false });
    this.taxYearLabelingControl?.updateValueAndValidity({ emitEvent: false });
  }

  private handleFormError(response: ApiErrorResponse): void {
    this.httpErrors = true;
    this.errors = response?.errors ?? { general: ['GenericError'] };
    this.errorMessageService.setFormErrors(this.projectForm, this.errors);
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

  get taxYearTypeControl() {
    return this.projectForm.get('taxYearType');
  }

  get taxYearStartMonthControl() {
    return this.projectForm.get('taxYearStartMonth');
  }

  get taxYearStartDayControl() {
    return this.projectForm.get('taxYearStartDay');
  }

  get taxYearLabelingControl() {
    return this.projectForm.get('taxYearLabeling');
  }

  isCustomTaxYearTypeSelected(): boolean {
    return this.taxYearTypeControl?.value === TaxYearType.CustomStartMonth;
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
