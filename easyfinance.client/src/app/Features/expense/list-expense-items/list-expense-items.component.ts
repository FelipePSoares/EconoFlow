import { Component, Input } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ExpenseService } from '../../../core/services/expense.service';
import { ExpenseItem } from '../../../core/models/expense-item';
import { mapper } from '../../../core/utils/mappings/mapper';
import { Expense } from '../../../core/models/expense';
import { ExpenseDto } from '../models/expense-dto';
import { Router } from '@angular/router';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { compare } from 'fast-json-patch';

@Component({
  selector: 'app-list-expense-items',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    FontAwesomeModule
  ],
  templateUrl: './list-expense-items.component.html',
  styleUrl: './list-expense-items.component.css'
})
export class ListExpenseItemsComponent {
  private _expenseId!: string;
  private expense: BehaviorSubject<ExpenseDto> = new BehaviorSubject<ExpenseDto>(new ExpenseDto());
  expense$: Observable<ExpenseDto> = this.expense.asObservable();
  expenseItemForm!: FormGroup;
  editingExpenseItem: ExpenseItemDto = new ExpenseItemDto();
  httpErrors = false;
  errors: any;
  faPlus = faPlus;

  @Input({ required: true })
  categoryId!: string;

  @Input({ required: true })
  projectId!: string;

  get expenseId(): string {
    return this._expenseId;
  }
  @Input({ required: true })
  set expenseId(expenseId: string) {
    this._expenseId = expenseId;
    this.expenseService.getById(this.projectId, this.categoryId, this._expenseId)
      .pipe(map(expense => mapper.map(expense, Expense, ExpenseDto)))
      .subscribe(
        {
          next: res => { this.expense.next(res); }
        });
  }

  @Input({ required: true })
  currentDate!: Date;

  constructor(public expenseService: ExpenseService, private router: Router) {
    this.edit(new ExpenseItemDto());
  }

  get id() {
    return this.expenseItemForm.get('id');
  }
  get name() {
    return this.expenseItemForm.get('name');
  }
  get date() {
    return this.expenseItemForm.get('date');
  }
  get amount() {
    return this.expenseItemForm.get('amount');
  }

  save(): void {
    if (this.expenseItemForm.valid) {
      let id = this.id?.value;
      let name = this.name?.value;
      let date = this.date?.value;
      let amount = this.amount?.value;

      let expense = this.expense.getValue();
      let expenseItemsNewArray: ExpenseItemDto[] = JSON.parse(JSON.stringify(expense.items));

      expenseItemsNewArray.forEach(expenseItem => {
        if (expenseItem.id == id) {
          expenseItem.name = name;
          expenseItem.date = date;
          expenseItem.amount = amount;
        }
      })

      var newExpense = <ExpenseDto>({
        id: expense.id,
        name: expense.name,
        date: expense.date,
        amount: expense.amount,
        goal: expense.goal,
        items: expenseItemsNewArray
      });

      var patch = compare(expense, newExpense);

      this.expenseService.update(this.projectId, this.categoryId, this.expenseId, patch).subscribe({
        next: response => {
          this.expense.next(mapper.map(response, Expense, ExpenseDto));
          this.editingExpenseItem = new ExpenseItemDto();
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
        }
      });
    }
  }

  edit(expenseItem: ExpenseItemDto): void {
    this.editingExpenseItem = expenseItem;
    this.expenseItemForm = new FormGroup({
      id: new FormControl(expenseItem.id),
      name: new FormControl(expenseItem.name, [Validators.required]),
      date: new FormControl(expenseItem.date, [Validators.required]),
      amount: new FormControl(expenseItem.amount, [Validators.pattern('[0-9]*')]),
    });
  }

  cancelEdit(): void {
    this.editingExpenseItem = new ExpenseItemDto();
  }

  add(): void {
    this.router.navigate(['projects', this.projectId, 'categories', this.categoryId, 'expenses', this.expenseId, 'add-expense-item', { currentDate: this.currentDate.toJSON() }]);
  }

  remove(id: string): void {
    this.expenseService.removeItem(this.projectId, this.categoryId, this.expenseId, id).subscribe({
      next: response => {
        let expenseUpdated: ExpenseDto = this.expense.getValue();

        expenseUpdated.items.forEach((item, index) => {
          if (item.id === id) { expenseUpdated.items.splice(index, 1); }
        });

        this.expense.next(expenseUpdated);
      }
    });
  }
}
