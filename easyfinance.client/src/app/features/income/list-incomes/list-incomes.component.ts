import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Income } from 'src/app/core/models/income';
import { IncomeService } from 'src/app/core/services/income.service';
import { IncomeDto } from '../models/income-dto';
import { mapper } from 'src/app/core/utils/mappings/mapper';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AsyncPipe, CommonModule, getCurrencySymbol } from '@angular/common';
import { compare } from 'fast-json-patch';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faTrash, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatError, MatFormField, MatLabel, MatSuffix } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatButton } from "@angular/material/button";
import { ApiErrorResponse } from "../../../core/models/error";
import { ErrorMessageService } from "../../../core/services/error-message.service";
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { dateUTC } from '../../../core/utils/date';
import { GlobalService } from '../../../core/services/global.service';
import { UserService } from '../../../core/services/user.service';
import { CurrencyMaskModule } from 'ng2-currency-mask';

@Component({
    selector: 'app-list-incomes',
    imports: [
        CommonModule,
        AsyncPipe,
        ReactiveFormsModule,
        FontAwesomeModule,
        ConfirmDialogComponent,
        AddButtonComponent,
        ReturnButtonComponent,
        CurrentDateComponent,
        CurrencyFormatPipe,
        MatDatepickerModule,
        MatError,
        MatFormField,
        MatInput,
        MatLabel,
        MatSuffix,
        MatButton,
        CurrencyMaskModule
    ],
    templateUrl: './list-incomes.component.html',
    styleUrl: './list-incomes.component.css'
})

export class ListIncomesComponent implements OnInit {
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;
  faPenToSquare = faPenToSquare;
  faFloppyDisk = faFloppyDisk;
  faTrash = faTrash;
  private incomes: BehaviorSubject<IncomeDto[]> = new BehaviorSubject<IncomeDto[]>([new IncomeDto()]);
  incomes$: Observable<IncomeDto[]> = this.incomes.asObservable();
  incomeForm!: FormGroup;
  editingIncome: IncomeDto = new IncomeDto();
  itemToDelete!: string;
  httpErrors = false;
  thousandSeparator!: string; 
  decimalSeparator !: string; 
  errors: any;
  currencySymbol!: string;

  @Input({ required: true })
  projectId!: string;

  constructor(
    private incomeService: IncomeService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private globalService: GlobalService,
    private userService: UserService
  ) {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator  = this.globalService.decimalSeparator;
    this.userService.loggedUser$.subscribe(value => this.currencySymbol = getCurrencySymbol(value.preferredCurrency, "narrow"));
  }

  ngOnInit(): void {
    this.fillData(CurrentDateComponent.currentDate);
    this.edit(new IncomeDto());
  }

  fillData(date: Date) {
    this.incomeService.get(this.projectId, date)
      .pipe(map(incomes => mapper.mapArray(incomes, Income, IncomeDto)))
      .subscribe(
        {
          next: res => { this.incomes.next(res); }
        });
  }

  get id() {
    return this.incomeForm.get('id');
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

  save(): void {
    if (this.incomeForm.valid) {
      const id = this.id?.value;
      const name = this.name?.value;
      const date = this.date?.value.toISOString().split("T")[0];
      let amount = this.amount?.value;

      var newIncome = <IncomeDto>({
        id: id,
        name: name,
        amount: amount,
        date: date
      })
      var patch = compare(this.editingIncome, newIncome);

      this.incomeService.update(this.projectId, id, patch).subscribe({
        next: response => {
          this.editingIncome.name = response.name;
          this.editingIncome.amount = response.amount;
          this.editingIncome.date = response.date;
          this.editingIncome = new IncomeDto();
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.incomeForm, this.errors);
        }
      });
    }
  }

  add() {
    this.router.navigate(['projects', this.projectId, 'add-income']);
  }

  edit(income: IncomeDto): void {
    this.editingIncome = income;
    let newDate = dateUTC(income.date);
    this.incomeForm = new FormGroup({
      id: new FormControl(income.id),
      name: new FormControl(income.name, [Validators.required]),
      date: new FormControl(newDate, [Validators.required]),
      amount: new FormControl(income.amount, [Validators.min(0)]),
    });
  }

  cancelEdit(): void {
    this.editingIncome = new IncomeDto();
  }

  remove(id: string): void {
    this.incomeService.remove(this.projectId, id).subscribe({
      next: response => {
        const incomesNewArray: IncomeDto[] = this.incomes.getValue();

        incomesNewArray.forEach((item, index) => {
          if (item.id === id) { incomesNewArray.splice(index, 1); }
        });

        this.incomes.next(incomesNewArray);
      }
    })
  }

  triggerDelete(itemId: string): void {
    this.itemToDelete = itemId;
    this.ConfirmDialog.openModal('Delete Item', 'Are you sure you want to delete this item?', 'Delete');
  }

  handleConfirmation(result: boolean): void {
    if (result) {
      this.remove(this.itemToDelete);
    }
  }

  updateDate(newDate: Date) {
    this.fillData(newDate);
  }

  previous() {
    this.router.navigate(['/projects', this.projectId]);
  }


  getFormFieldErrors(fieldName: string): string[] {
    const control = this.incomeForm.get(fieldName);
    const errors: string[] = [];

    if (control && control.errors) {
      for (const key in control.errors) {
        if (control.errors.hasOwnProperty(key)) {
          switch (key) {
            case 'required':
              errors.push('This field is required.');
              break;
            case 'min':
              errors.push(`The value should be greater than ${control.errors[key].min}.`);
              break;
            default:
              errors.push(control.errors[key]);
          }
        }
      }
    }

    return errors;
  }
}
