import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Moment } from 'moment';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { TranslateModule } from '@ngx-translate/core';
import { ApiErrorResponse } from '../../../core/models/error';
import { PlanEntryRequest } from '../../../core/models/plan-entry';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { PlanService } from '../../../core/services/plan.service';
import { formatDate, toUtcMomentDate } from '../../../core/utils/date';
import { PlanEntryDto } from '../models/plan-entry-dto';

type PlanEntryAction = 'add' | 'remove';

@Component({
  selector: 'app-add-plan-entry',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    CurrencyMaskModule,
    TranslateModule
  ],
  templateUrl: './add-plan-entry.component.html',
  styleUrl: './add-plan-entry.component.css'
})
export class AddPlanEntryComponent implements OnInit, OnChanges {
  private planService = inject(PlanService);
  private globalService = inject(GlobalService);
  private currentDateService = inject(CurrentDateService);
  private errorMessageService = inject(ErrorMessageService);

  entryForm!: FormGroup;
  isSaving = false;
  httpErrors = false;
  errors: Record<string, string[]> = {};
  currencySymbol = this.globalService.currencySymbol;
  thousandSeparator = this.globalService.groupSeparator;
  decimalSeparator = this.globalService.decimalSeparator;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  planId!: string;

  @Input()
  selectedDate?: Date;

  @Input()
  inlineMode = true;

  @Output()
  saved = new EventEmitter<PlanEntryDto>();

  @Output()
  canceled = new EventEmitter<void>();

  ngOnInit(): void {
    this.entryForm = new FormGroup({
      action: new FormControl<PlanEntryAction>('add', [Validators.required]),
      amount: new FormControl(0, [Validators.required, Validators.min(0.01)]),
      date: new FormControl(this.toDateInput(this.selectedDate), [Validators.required]),
      note: new FormControl('', [Validators.maxLength(500)])
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['selectedDate'] || !this.entryForm) {
      return;
    }

    this.entryForm.patchValue({
      date: this.toDateInput(this.selectedDate)
    });
  }

  get actionControl(): FormControl | null {
    return this.entryForm.get('action') as FormControl | null;
  }

  get amountControl(): FormControl | null {
    return this.entryForm.get('amount') as FormControl | null;
  }

  get dateControl(): FormControl | null {
    return this.entryForm.get('date') as FormControl | null;
  }

  get noteControl(): FormControl | null {
    return this.entryForm.get('note') as FormControl | null;
  }

  saveEntry(): void {
    if (!this.entryForm.valid || this.isSaving) {
      return;
    }

    this.httpErrors = false;
    this.errors = {};
    this.isSaving = true;

    const action = (this.actionControl?.value ?? 'add') as PlanEntryAction;
    const amount = Math.abs(Number(this.amountControl?.value ?? 0));
    const amountSigned = action === 'remove' ? -amount : amount;
    const dateValue = this.dateControl?.value as Moment;
    const note = String(this.noteControl?.value ?? '').trim();

    const request: PlanEntryRequest = {
      date: formatDate(dateValue),
      amountSigned,
      note
    };

    this.planService.addEntry(this.projectId, this.planId, request).subscribe({
      next: response => {
        this.isSaving = false;
        this.resetForm(this.selectedDate ?? this.currentDateService.currentDate);
        this.saved.emit(PlanEntryDto.fromPlanEntry(response));
      },
      error: (response: ApiErrorResponse) => {
        this.isSaving = false;
        this.handleError(response);
      }
    });
  }

  cancel(): void {
    this.canceled.emit();
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.entryForm, fieldName);
  }

  private resetForm(date: Date): void {
    this.entryForm.reset({
      action: 'add',
      amount: 0,
      date: this.toDateInput(date),
      note: ''
    });
  }

  private handleError(response: ApiErrorResponse): void {
    this.httpErrors = true;
    this.errors = response.errors ?? {};
    this.errorMessageService.setFormErrors(this.entryForm, this.errors);
  }

  private toDateInput(date?: Date): Moment {
    return toUtcMomentDate(date ?? this.currentDateService.currentDate);
  }
}
