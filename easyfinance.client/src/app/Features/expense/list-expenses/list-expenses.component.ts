import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ExpenseDto } from '../models/expense-dto';
import { Expense } from '../../../core/models/expense';
import { map } from 'rxjs/internal/operators/map';
import { mapper } from '../../../core/utils/mappings/mapper';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { ExpenseService } from '../../../core/services/expense.service';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { compare } from 'fast-json-patch';

@Component({
  selector: 'app-list-expenses',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    FontAwesomeModule],
  templateUrl: './list-expenses.component.html',
  styleUrl: './list-expenses.component.css'
})
export class ListExpensesComponent {
  private _filterDate!: Date;
  private expenses: BehaviorSubject<ExpenseDto[]> = new BehaviorSubject<ExpenseDto[]>([new ExpenseDto()]);
  expenses$: Observable<ExpenseDto[]> = this.expenses.asObservable();
  expenseForm!: FormGroup;
  editingExpense: ExpenseDto = new ExpenseDto();
  httpErrors = false;
  errors: any;
  faPlus = faPlus;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  get filterDate(): Date {
    return this._filterDate;
  }
  @Input({ required: true })
  set filterDate(filterDate: Date) {
    this._filterDate = filterDate;
    this.expenseService.get(this.projectId, this.categoryId, this._filterDate)
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
    this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, 'expenses', id, { filterDate: this.filterDate.toISOString().substring(0, 10) }]);
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
        date: date,
        amount: amount,
        goal: goal
      })

      var patch = compare(this.editingExpense, newExpense);

      this.expenseService.update(this.projectId, this.categoryId, id, patch).subscribe({
        next: response => {
          this.editingExpense.name = response.name;
          this.editingExpense.date = response.date;
          this.editingExpense.amount = response.amount;
          this.editingExpense.goal = response.goal;
          this.editingExpense = new ExpenseDto();
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
    this.expenseForm = new FormGroup({
      id: new FormControl(expense.id),
      name: new FormControl(expense.name, [Validators.required]),
      date: new FormControl(expense.date, [Validators.required]),
      amount: new FormControl(expense.amount, [Validators.pattern('[0-9]*')]),
      goal: new FormControl(expense.goal, [Validators.pattern('[0-9]*')]),
    });
  }

  cancelEdit(): void {
    this.editingExpense = new ExpenseDto();
  }

  add(): void {
    this.router.navigate(['projects', this.projectId, 'categories', this.categoryId, 'add-expense', { currentDate: this.filterDate.toISOString().substring(0, 10) }]);
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
}
