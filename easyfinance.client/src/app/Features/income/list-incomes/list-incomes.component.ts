import { Component, Input } from '@angular/core';
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

@Component({
  selector: 'app-list-incomes',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    FontAwesomeModule
  ],
  templateUrl: './list-incomes.component.html',
  styleUrls: ['./list-incomes.component.css', '../../styles/shared.scss']
})

export class ListIncomesComponent {
  faPenToSquare = faPenToSquare;
  faFloppyDisk = faFloppyDisk;
  faTrash = faTrash;
  private _currentDate!: Date;
  private incomes: BehaviorSubject<IncomeDto[]> = new BehaviorSubject<IncomeDto[]>([new IncomeDto()]);
  incomes$: Observable<IncomeDto[]> = this.incomes.asObservable();
  incomeForm!: FormGroup;
  editingIncome: IncomeDto = new IncomeDto();
  httpErrors = false;
  errors: any;

  get currentDate(): Date {
    return this._currentDate;
  }
  @Input({ required: true })
  set currentDate(currentDate: Date) {
    this._currentDate = currentDate;
    this.incomeService.get(this.projectId, this._currentDate)
      .pipe(map(incomes => mapper.mapArray(incomes, Income, IncomeDto)))
      .subscribe(
        {
          next: res => { this.incomes.next(res); }
        });
  }

  @Input({ required: true })
  projectId!: string;

  constructor(public incomeService: IncomeService) {
    this.edit(new IncomeDto());
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
      const amount = this.amount?.value;

      var newIncome = <IncomeDto>({
        id: id,
        name: name,
        amount: amount,
        date: new Date(date)
      })
      var patch = compare(this.editingIncome, newIncome);

      this.incomeService.update(this.projectId, id, patch).subscribe({
        next: response => {
          this.editingIncome.name = response.name;
          this.editingIncome = new IncomeDto();
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
        }
      });
    }
  }

  edit(income: IncomeDto): void {
    this.editingIncome = income;
    let newDate = new Date(income.date);
    this.incomeForm = new FormGroup({
      id: new FormControl(income.id),
      name: new FormControl(income.name, [Validators.required]),
      date: new FormControl(newDate.getFullYear() + '-' + String(newDate.getMonth() + 1).padStart(2, '0') + '-' + String(newDate.getDate()).padStart(2, '0'), [Validators.required, Validators.pattern('^\\d{4}\\-(0[1-9]|1[012])\\-(0[1-9]|[12][0-9]|3[01])$')]),
      amount: new FormControl(income.amount, [Validators.required, Validators.pattern('(\\d+)?(\\,\\d{1,2})?')]),
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
}
