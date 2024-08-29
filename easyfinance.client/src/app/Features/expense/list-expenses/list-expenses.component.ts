import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpenseDto } from '../models/expense-dto';
import { Expense } from '../../../core/models/expense';
import { map } from 'rxjs/internal/operators/map';
import { mapper } from '../../../core/utils/mappings/mapper';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { ExpenseService } from '../../../core/services/expense.service';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { compare } from 'fast-json-patch';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';

@Component({
  selector: 'app-list-expenses',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    CurrentDateComponent,
    AddButtonComponent,
    ReturnButtonComponent
  ],
  templateUrl: './list-expenses.component.html',
  styleUrl: './list-expenses.component.css'
})
export class ListExpensesComponent {
  private _currentDate!: Date;
  private expenses: BehaviorSubject<ExpenseDto[]> = new BehaviorSubject<ExpenseDto[]>([new ExpenseDto()]);
  expenses$: Observable<ExpenseDto[]> = this.expenses.asObservable();
  expenseForm!: FormGroup;
  editingExpense: ExpenseDto = new ExpenseDto();
  httpErrors = false;
  errors: any;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  get currentDate(): Date {
    return this._currentDate;
  }
  @Input({ required: true })
  set currentDate(currentDate: Date) {
    this._currentDate = new Date(currentDate);
    this.expenseService.get(this.projectId, this.categoryId, this._currentDate)
      .pipe(map(expenses => mapper.mapArray(expenses, Expense, ExpenseDto)))
      .subscribe(
        {
          next: res => { this.expenses.next(res); }
        });
  }

  constructor(public expenseService: ExpenseService, private router: Router) {
    this.edit(new ExpenseDto());
  }

  get id() {
    return this.expenseForm.get('id');
  }
  get name() {
    return this.expenseForm.get('name');
  }
  get date() {
    return this.expenseForm.get('date');
  }
  get amount() {
    return this.expenseForm.get('amount');
  }
  get goal() {
    return this.expenseForm.get('goal');
  }

  select(id: string): void {
    this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, 'expenses', id, { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }

  save(): void {
    if (this.expenseForm.valid) {
      let id = this.id?.value;
      let name = this.name?.value;
      let date = this.date?.value;
      let amount = this.amount?.value;
      let goal = this.goal?.value;

      var newExpense = <ExpenseDto>({
        id: id,
        name: name,
        date: new Date(date),
        amount: amount,
        goal: goal,
        items: this.editingExpense.items
      })

      var patch = compare(this.editingExpense, newExpense);

      this.expenseService.update(this.projectId, this.categoryId, id, patch).subscribe({
        next: response => {
          this.editingExpense = new ExpenseDto();
          this.currentDate = new Date(response.date);
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
        }
      });
    }
  }

  edit(expense: ExpenseDto): void {
    this.editingExpense = expense;
    let newDate = new Date(expense.date);
    this.expenseForm = new FormGroup({
      id: new FormControl(expense.id),
      name: new FormControl(expense.name, [Validators.required]),
      date: new FormControl(newDate.getFullYear() + '-' + String(newDate.getMonth() + 1).padStart(2, '0') + '-' + String(newDate.getDate()).padStart(2, '0'), [Validators.required, Validators.pattern('^\\d{4}\\-(0[1-9]|1[012])\\-(0[1-9]|[12][0-9]|3[01])$')]),
      amount: new FormControl(expense.amount, [Validators.pattern('(\\d+)?(\\,\\d{1,2})?')]),
      goal: new FormControl(expense.goal, [Validators.pattern('[0-9]*')]),
    });
  }

  cancelEdit(): void {
    this.editingExpense = new ExpenseDto();
  }

  remove(id: string): void {
    this.expenseService.remove(this.projectId, this.categoryId, id).subscribe({
      next: response => {
        const expensesNewArray: ExpenseDto[] = this.expenses.getValue();

        expensesNewArray.forEach((item, index) => {
          if (item.id === id) { expensesNewArray.splice(index, 1); }
        });

        this.expenses.next(expensesNewArray);
      }
    })
  }

  updateDate(newDate: Date) {
    this.currentDate = newDate;
  }

  add(): void {
    this.router.navigate(['projects', this.projectId, 'categories', this.categoryId, 'add-expense', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }

  previous() {
    this.router.navigate(['/projects', this.projectId, { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }
}
