import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Income } from 'src/app/core/models/income';
import { IncomeService } from 'src/app/core/services/income.service';
import { IncomeDto } from '../models/income-dto';
import { mapper } from 'src/app/core/utils/mappings/mapper';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AsyncPipe, CommonModule } from '@angular/common';
import { compare } from 'fast-json-patch';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons';
import { MatInput } from "@angular/material/input";
import { MatButton } from "@angular/material/button";
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatError, MatFormField, MatLabel, MatSuffix } from "@angular/material/form-field";
import { MatCardModule } from '@angular/material/card';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { ApiErrorResponse } from "../../../core/models/error";
import { ErrorMessageService } from "../../../core/services/error-message.service";
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { dateUTC } from '../../../core/utils/date';
import { GlobalService } from '../../../core/services/global.service';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { ProjectService } from '../../../core/services/project.service';
import { UserProjectDto } from '../../project/models/user-project-dto';
import { Role } from '../../../core/enums/Role';

@Component({
    selector: 'app-list-incomes',
    imports: [
        CommonModule,
        AsyncPipe,
        ReactiveFormsModule,
        MatCardModule,
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
        CurrencyMaskModule,
        TranslateModule
    ],
    templateUrl: './list-incomes.component.html',
    styleUrl: './list-incomes.component.css'
})

export class ListIncomesComponent implements OnInit {
  faPenToSquare = faPenToSquare;
  faTrash = faTrash;
  faPlus = faPlus;

  private incomes: BehaviorSubject<IncomeDto[]> = new BehaviorSubject<IncomeDto[]>([new IncomeDto()]);
  incomes$: Observable<IncomeDto[]> = this.incomes.asObservable();
  incomeForm!: FormGroup;
  editingIncome: IncomeDto = new IncomeDto();
  itemToDelete!: string;
  httpErrors = false;
  thousandSeparator!: string; 
  decimalSeparator !: string; 
  errors!: { [key: string]: string };
  currencySymbol!: string;
  userProject!: UserProjectDto;

  @Input({ required: true })
  projectId!: string;

  constructor(
    private incomeService: IncomeService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private globalService: GlobalService,
    private dialog: MatDialog,
    private projectService: ProjectService,
    private translateService: TranslateService
  ) {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator;
    this.currencySymbol = this.globalService.currencySymbol;
  }

  ngOnInit(): void {
    this.projectService.selectedUserProject$.subscribe(userProject => {
      if (userProject) {
        this.userProject = userProject;
      } else {
        this.projectService.getUserProject(this.projectId)
          .subscribe(res => {
            this.projectService.selectUserProject(res);
            this.userProject = res;
          });
      }
    });

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
        amount: amount === "" || amount === null ? 0 : amount,
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
    this.router.navigate([{ outlets: { modal: ['projects', this.projectId, 'add-income'] } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: 'input'
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.fillData(CurrentDateComponent.currentDate);
      }
      this.router.navigate([{ outlets: { modal: null } }]);
    });
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

  triggerDelete(income: IncomeDto): void {
    this.itemToDelete = income.id;
    var message = this.translateService.instant('AreYouSureYouWantDeleteIncome', { value: income.name });

    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'DeleteIncome', message: message, action: 'ButtonDelete' },
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.remove(this.itemToDelete);
      }
    });
  }

  updateDate(newDate: Date) {
    this.fillData(newDate);
  }

  previous() {
    this.router.navigate(['/projects', this.projectId]);
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.incomeForm, fieldName);
  }

  canAddOrEdit(): boolean {
    return this.userProject.role === Role.Admin || this.userProject.role === Role.Manager;
  }
}
