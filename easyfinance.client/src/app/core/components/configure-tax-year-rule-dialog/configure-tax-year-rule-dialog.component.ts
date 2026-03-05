import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { TaxYearType } from '../../enums/tax-year-type';
import { TaxYearLabeling } from '../../enums/tax-year-labeling';
import { ProjectTaxYearSettings, ProjectTaxYearSettingsRequest } from '../../models/project-tax-year-settings';
import { ApiErrorResponse } from '../../models/error';

export interface ConfigureTaxYearRuleDialogData {
  projectId: string;
  initialSettings?: ProjectTaxYearSettings | null;
}

@Component({
  selector: 'app-configure-tax-year-rule-dialog',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    TranslateModule
  ],
  templateUrl: './configure-tax-year-rule-dialog.component.html',
  styleUrl: './configure-tax-year-rule-dialog.component.css'
})
export class ConfigureTaxYearRuleDialogComponent {
  taxYearForm: FormGroup;
  httpErrors = false;
  errors!: Record<string, string[]>;
  isSaving = false;

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
    private dialogRef: MatDialogRef<ConfigureTaxYearRuleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfigureTaxYearRuleDialogData,
    private projectService: ProjectService,
    private errorMessageService: ErrorMessageService
  ) {
    const initialTaxYearType = data.initialSettings?.taxYearType ?? TaxYearType.CalendarYear;
    const initialStartMonth = data.initialSettings?.taxYearStartMonth ?? 1;
    const initialStartDay = data.initialSettings?.taxYearStartDay ?? 1;
    const initialLabeling = data.initialSettings?.taxYearLabeling ?? TaxYearLabeling.ByStartYear;

    this.taxYearForm = new FormGroup({
      taxYearType: new FormControl(initialTaxYearType, [Validators.required]),
      taxYearStartMonth: new FormControl(initialStartMonth),
      taxYearStartDay: new FormControl(initialStartDay),
      taxYearLabeling: new FormControl(initialLabeling)
    });

    this.updateTaxYearControlValidation();
    this.taxYearTypeControl?.valueChanges.subscribe(() => this.updateTaxYearControlValidation());
  }

  close(): void {
    this.dialogRef.close(null);
  }

  async save(): Promise<void> {
    if (!this.taxYearForm.valid || this.isSaving) {
      return;
    }

    this.httpErrors = false;
    this.errors = {};
    this.isSaving = true;

    try {
      const request = this.getTaxYearSettingsRequest();
      const response = await firstValueFrom(this.projectService.upsertTaxYearSettings(this.data.projectId, request));
      this.dialogRef.close(response);
    } catch (error) {
      this.handleFormError(error as ApiErrorResponse);
    } finally {
      this.isSaving = false;
    }
  }

  get taxYearTypeControl() {
    return this.taxYearForm.get('taxYearType');
  }

  get taxYearStartMonthControl() {
    return this.taxYearForm.get('taxYearStartMonth');
  }

  get taxYearStartDayControl() {
    return this.taxYearForm.get('taxYearStartDay');
  }

  get taxYearLabelingControl() {
    return this.taxYearForm.get('taxYearLabeling');
  }

  isCustomTaxYearTypeSelected(): boolean {
    return this.taxYearTypeControl?.value === TaxYearType.CustomStartMonth;
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.taxYearForm, fieldName);
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

    return { taxYearType: TaxYearType.CalendarYear };
  }

  private updateTaxYearControlValidation(): void {
    const customTaxYear = this.taxYearTypeControl?.value === TaxYearType.CustomStartMonth;

    if (customTaxYear) {
      this.taxYearStartMonthControl?.setValidators([Validators.required, Validators.min(1), Validators.max(12)]);
      this.taxYearStartDayControl?.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
      this.taxYearLabelingControl?.setValidators([Validators.required]);
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
    this.errorMessageService.setFormErrors(this.taxYearForm, this.errors);
  }
}
