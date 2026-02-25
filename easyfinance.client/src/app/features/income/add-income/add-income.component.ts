import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AfterViewInit, Component, DestroyRef, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { compare } from 'fast-json-patch';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Moment } from 'moment';
import { IncomeService } from '../../../core/services/income.service';
import { IncomeDto } from '../models/income-dto';
import { IncomePatchModel } from '../models/income-patch-model';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { formatDate, toLocalDate, toUtcMomentDate } from '../../../core/utils/date';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';

@Component({
    selector: 'app-add-income',
    imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    CurrencyMaskModule,
    TranslateModule
],
    templateUrl: './add-income.component.html',
    styleUrl: './add-income.component.css'
})
export class AddIncomeComponent implements OnInit, AfterViewInit {
  private incomeService = inject(IncomeService);
  private router = inject(Router);
  private errorMessageService = inject(ErrorMessageService);
  private globalService = inject(GlobalService);
  private currentDateService = inject(CurrentDateService);
  private dateAdapter = inject(DateAdapter<Date>);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  private currentDate!: Moment;
  private editingIncome: IncomeDto | null = null;
  incomeForm!: FormGroup;
  isSaving = false;
  httpErrors = false;
  errors!: Record<string, string[]>;
  currencySymbol!: string;
  thousandSeparator!: string; 
  decimalSeparator !: string; 

  @Input({ required: true })
  projectId!: string;

  @Input()
  income?: IncomeDto | null;

  @Input()
  inlineMode = false;

  @Output()
  saved = new EventEmitter<IncomeDto>();

  @Output()
  canceled = new EventEmitter<void>();

  @ViewChild('nameInput') nameInput?: ElementRef<HTMLInputElement>;

  constructor() {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator;
    this.currencySymbol = this.globalService.currencySymbol;
  }

  ngOnInit(): void {
    this.dateAdapter.setLocale(this.globalService.currentLanguage);
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.dateAdapter.setLocale(event.lang));

    this.currentDate = toUtcMomentDate(this.currentDateService.currentDate);
    this.editingIncome = this.income && !this.isNewEntity(this.income.id)
      ? structuredClone(this.income)
      : null;

    const initialDate = this.editingIncome?.date
      ? toUtcMomentDate(this.editingIncome.date)
      : this.currentDate;

    this.incomeForm = new FormGroup({
      name: new FormControl(this.editingIncome?.name ?? '', [Validators.required, Validators.maxLength(100)]),
      date: new FormControl(initialDate, [Validators.required]),
      amount: new FormControl(this.editingIncome?.amount ?? 0, [Validators.min(0)])
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.nameInput?.nativeElement.focus());
  }

  get isEditing(): boolean {
    return !!this.editingIncome;
  }

  saveIncome(): void {
    if (!this.incomeForm.valid || this.isSaving) {
      return;
    }

    this.httpErrors = false;
    this.errors = {};

    const name = this.name?.value;
    const date: any = formatDate(this.date?.value);
    const amount = this.amount?.value;
    const parsedAmount = amount === '' || amount === null ? 0 : amount;

    this.isSaving = true;

    if (this.editingIncome) {
      const updatedIncome = structuredClone(this.editingIncome);
      updatedIncome.name = name;
      updatedIncome.date = toLocalDate(date);
      updatedIncome.amount = parsedAmount;

      const patch = compare(
        IncomePatchModel.fromIncome(this.editingIncome),
        IncomePatchModel.fromIncome(updatedIncome)
      );

      if (patch.length === 0) {
        this.isSaving = false;
        this.handleSaved(this.editingIncome);
        return;
      }

      this.incomeService.update(this.projectId, this.editingIncome.id, patch).subscribe({
        next: response => {
          this.isSaving = false;
          this.handleSaved(IncomeDto.fromIncome(response));
        },
        error: (response: ApiErrorResponse) => {
          this.isSaving = false;
          this.httpErrors = true;
          this.errors = response.errors;
          this.errorMessageService.setFormErrors(this.incomeForm, this.errors);
        }
      });
      return;
    }

    const newIncome = ({
      name: name,
      date: date,
      amount: parsedAmount
    }) as IncomeDto;

    this.incomeService.add(this.projectId, newIncome).subscribe({
      next: response => {
        this.isSaving = false;
        this.handleSaved(IncomeDto.fromIncome(response));
      },
      error: (response: ApiErrorResponse) => {
        this.isSaving = false;
        this.httpErrors = true;
        this.errors = response.errors;
        this.errorMessageService.setFormErrors(this.incomeForm, this.errors);
      }
    });
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.incomeForm, fieldName);
  }

  get name() {
    return this.incomeForm.get('name');
  }
  get date() {
    return this.incomeForm.get('date');
  }
  get amount() {
    return this.incomeForm.get('amount');
  }

  cancel(): void {
    if (this.inlineMode) {
      this.canceled.emit();
      return;
    }

    this.router.navigate([{ outlets: { modal: null } }]);
  }

  private handleSaved(income: IncomeDto): void {
    this.saved.emit(income);

    if (this.inlineMode) {
      return;
    }

    this.router.navigate([{ outlets: { modal: null } }]);
  }

  private isNewEntity(id: string | undefined): boolean {
    return !!id && id.startsWith('new-');
  }
}
