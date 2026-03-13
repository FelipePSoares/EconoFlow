import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { compare } from 'fast-json-patch';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { take } from 'rxjs';
import { PlanType } from '../../../core/enums/plan-type';
import { ApiErrorResponse } from '../../../core/models/error';
import { PlanRequest } from '../../../core/models/plan';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { PlanService } from '../../../core/services/plan.service';
import { PlanDto } from '../models/plan-dto';
import { PlanPatchModel } from '../models/plan-patch-model';

@Component({
  selector: 'app-add-edit-plan',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    CurrencyMaskModule,
    TranslateModule
  ],
  templateUrl: './add-edit-plan.component.html',
  styleUrl: './add-edit-plan.component.css'
})
export class AddEditPlanComponent implements OnInit, OnChanges {
  private planService = inject(PlanService);
  private errorMessageService = inject(ErrorMessageService);
  private globalService = inject(GlobalService);

  private editingPlan: PlanDto | null = null;

  planForm!: FormGroup;
  isSaving = false;
  httpErrors = false;
  errors: Record<string, string[]> = {};
  currencySymbol = this.globalService.currencySymbol;
  thousandSeparator = this.globalService.groupSeparator;
  decimalSeparator = this.globalService.decimalSeparator;

  readonly planTypeOptions: { value: PlanType; label: string }[] = [
    { value: PlanType.EmergencyReserve, label: 'PlanTypeEmergencyReserve' },
    { value: PlanType.Saving, label: 'PlanTypeSaving' }
  ];

  @Input({ required: true })
  projectId!: string;

  @Input()
  plan?: PlanDto | null;

  @Input()
  inlineMode = true;

  showEmergencyReserveOption = true;

  @Output()
  saved = new EventEmitter<PlanDto>();

  @Output()
  canceled = new EventEmitter<void>();

  ngOnInit(): void {
    this.syncFormWithPlan();
    this.updateEmergencyReserveTypeVisibility();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plan']) {
      this.syncFormWithPlan();
      this.updateEmergencyReserveTypeVisibility();
    }
  }

  get isEditing(): boolean {
    return !!this.editingPlan;
  }

  get typeControl(): FormControl | null {
    return this.planForm.get('type') as FormControl | null;
  }

  get nameControl(): FormControl | null {
    return this.planForm.get('name') as FormControl | null;
  }

  get targetAmountControl(): FormControl | null {
    return this.planForm.get('targetAmount') as FormControl | null;
  }

  get availablePlanTypeOptions(): { value: PlanType; label: string }[] {
    if (this.showEmergencyReserveOption) {
      return this.planTypeOptions;
    }

    return this.planTypeOptions.filter(option => option.value !== PlanType.EmergencyReserve);
  }

  savePlan(): void {
    if (!this.planForm.valid || this.isSaving) {
      return;
    }

    this.httpErrors = false;
    this.errors = {};
    this.isSaving = true;

    const planType = this.normalizePlanType(this.typeControl?.value, PlanType.EmergencyReserve);
    const name = String(this.nameControl?.value ?? '').trim();
    const targetAmount = Number(this.targetAmountControl?.value ?? 0);

    if (this.editingPlan) {
      const updatedPlan = this.toUpdatedPlan(this.editingPlan, planType, name, targetAmount);
      const patch = compare(
        PlanPatchModel.fromPlan(this.editingPlan),
        PlanPatchModel.fromPlan(updatedPlan)
      );

      if (patch.length === 0) {
        this.isSaving = false;
        this.handleSaved(this.editingPlan);
        return;
      }

      this.planService.updatePlan(this.projectId, this.editingPlan.id, patch).subscribe({
        next: response => {
          this.isSaving = false;
          this.handleSaved(PlanDto.fromPlan(response));
        },
        error: (response: ApiErrorResponse) => {
          this.isSaving = false;
          this.handleError(response);
        }
      });
      return;
    }

    const request: PlanRequest = {
      type: planType,
      name,
      targetAmount
    };

    this.planService.createPlan(this.projectId, request).subscribe({
      next: response => {
        this.isSaving = false;
        this.handleSaved(PlanDto.fromPlan(response));
      },
      error: (response: ApiErrorResponse) => {
        this.isSaving = false;
        this.handleError(response);
      }
    });
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.planForm, fieldName);
  }

  cancel(): void {
    this.canceled.emit();
  }

  private handleSaved(plan: PlanDto): void {
    this.saved.emit(plan);
  }

  private handleError(response: ApiErrorResponse): void {
    this.httpErrors = true;
    this.errors = response.errors ?? {};
    this.errorMessageService.setFormErrors(this.planForm, this.errors);
  }

  private toUpdatedPlan(existingPlan: PlanDto, type: PlanType, name: string, targetAmount: number): PlanDto {
    const updatedPlan = this.clonePlan(existingPlan);
    updatedPlan.type = type;
    updatedPlan.name = name;
    updatedPlan.targetAmount = targetAmount;
    return updatedPlan;
  }

  private clonePlan(plan: PlanDto): PlanDto {
    const clone = new PlanDto();
    clone.id = plan.id;
    clone.projectId = plan.projectId;
    clone.type = plan.type;
    clone.name = plan.name;
    clone.targetAmount = plan.targetAmount;
    clone.currentBalance = plan.currentBalance;
    clone.remaining = plan.remaining;
    clone.progress = plan.progress;
    clone.isArchived = plan.isArchived;
    return clone;
  }

  private syncFormWithPlan(): void {
    this.editingPlan = this.plan ? this.clonePlan(this.plan) : null;
    const defaultCreateType = this.showEmergencyReserveOption ? PlanType.EmergencyReserve : PlanType.Saving;
    const planType = this.editingPlan
      ? this.normalizePlanType(this.editingPlan.type, PlanType.Saving)
      : defaultCreateType;

    const formValue = {
      type: planType,
      name: this.editingPlan?.name ?? '',
      targetAmount: this.editingPlan?.targetAmount ?? 0
    };

    if (!this.planForm) {
      this.planForm = new FormGroup({
        type: new FormControl(formValue.type, [Validators.required]),
        name: new FormControl(formValue.name, [Validators.required, Validators.maxLength(150)]),
        targetAmount: new FormControl(formValue.targetAmount, [Validators.required, Validators.min(0)])
      });
      return;
    }

    this.planForm.reset(formValue);
    this.ensureSelectedTypeIsAllowed();
  }

  private updateEmergencyReserveTypeVisibility(): void {
    if (this.isEditing || !this.projectId) {
      this.showEmergencyReserveOption = true;
      this.ensureSelectedTypeIsAllowed();
      return;
    }

    this.planService.getPlans(this.projectId)
      .pipe(take(1))
      .subscribe({
        next: plans => {
          this.showEmergencyReserveOption = !plans.some(plan => plan.type === PlanType.EmergencyReserve);
          this.ensureSelectedTypeIsAllowed();
        },
        error: () => {
          this.showEmergencyReserveOption = true;
          this.ensureSelectedTypeIsAllowed();
        }
      });
  }

  private normalizePlanType(type: unknown, fallback: PlanType): PlanType {
    if (type === PlanType.EmergencyReserve || type === PlanType.Saving) {
      return type;
    }

    return fallback;
  }

  private ensureSelectedTypeIsAllowed(): void {
    if (this.showEmergencyReserveOption || this.isEditing) {
      return;
    }

    const selectedType = this.normalizePlanType(this.typeControl?.value, PlanType.Saving);
    if (selectedType === PlanType.EmergencyReserve) {
      this.typeControl?.setValue(PlanType.Saving);
    }
  }
}
