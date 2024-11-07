import { Component, Input, OnInit, ViewChild } from '@angular/core';
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
import { faPenToSquare, faTrash, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { dateUTC } from '../../../core/utils/date/date';

@Component({
  selector: 'app-list-incomes',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    FontAwesomeModule,
    ConfirmDialogComponent,
    AddButtonComponent,
    ReturnButtonComponent,
    CurrentDateComponent,
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
  errors: any;
  
  @Input({ required: true })
  projectId!: string;

  constructor(public incomeService: IncomeService, private router: Router) { 
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
      const date = this.date?.value;
      const amount = this.amount?.value.replace('.', '').replace(',', '.');

      var newIncome = <IncomeDto>({
        id: id,
        name: name,
        amount: amount,
        date: dateUTC(date)
      })
      var patch = compare(this.editingIncome, newIncome);

      this.incomeService.update(this.projectId, id, patch).subscribe({
        next: response => {
          this.editingIncome.name = response.name;
          this.editingIncome.amount = response.amount;
          this.editingIncome.date = response.date;
          this.editingIncome = new IncomeDto();
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
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
      date: new FormControl(newDate.getFullYear() + '-' + String(newDate.getMonth() + 1).padStart(2, '0') + '-' + String(newDate.getDate()).padStart(2, '0'), [Validators.required, Validators.pattern('^\\d{4}\\-(0[1-9]|1[012])\\-(0[1-9]|[12][0-9]|3[01])$')]),
      amount: new FormControl(income.amount?.toString().replace('.', ',') ?? 0, [Validators.required, Validators.pattern('(\\d+)?(\\,\\d{1,2})?')]),
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
}
