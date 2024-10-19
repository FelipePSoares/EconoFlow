import { Component, Input, OnInit, ViewChild } from '@angular/core';
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
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faTrash, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-list-expenses',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    ReactiveFormsModule,
    CurrentDateComponent,
    AddButtonComponent,
    ReturnButtonComponent,
    FontAwesomeModule,
    ConfirmDialogComponent
  ],
  templateUrl: './list-expenses.component.html',
  styleUrl: './list-expenses.component.css'
})
export class ListExpensesComponent {
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;
  faPenToSquare = faPenToSquare;
  faFloppyDisk = faFloppyDisk;
  faTrash = faTrash;
  private _currentDate!: Date;
  private expenses: BehaviorSubject<ExpenseDto[]> = new BehaviorSubject<ExpenseDto[]>([new ExpenseDto()]);
  expenses$: Observable<ExpenseDto[]> = this.expenses.asObservable();
  expenseForm!: FormGroup;
  editingExpense: ExpenseDto = new ExpenseDto();
  itemToDelete!: string;
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
  get budget() {
    return this.expenseForm.get('budget');
  }

  select(id: string): void {
    this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, 'expenses', id, { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }

  save(): void {
    if (this.expenseForm.valid) {
      let id = this.id?.value;
      let name = this.name?.value;
      let date = this.date?.value;
      let amount = this.amount?.value.replace('.', '').replace(',', '.');
      let budget = this.budget?.value;

      var newExpense = <ExpenseDto>({
        id: id,
        name: name,
        date: new Date(date),
        amount: amount,
        budget: budget,
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
      amount: new FormControl(expense.amount?.toString().replace('.', ',') ?? 0, [Validators.pattern('(\\d+)?(\\,\\d{1,2})?')]),
      budget: new FormControl(expense.budget ?? 0, [Validators.pattern('[0-9]*')]),
    });

    if (this.editingExpense?.items?.length ?? 0 > 0) {
      this.expenseForm.controls['amount'].disable();
    }
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
    this.router.navigate(['/projects', this.projectId, 'categories', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
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

  getPercentageWaste(waste: number, budget: number): number {
    return budget === 0 ? 0 : waste * 100 / budget;
  }

  getClassToProgressBar(percentage: number): string {
    if (percentage <= 75) {
      return 'bg-info';
    } else if (percentage <= 100) {
      return 'bg-warning';
    }

    return 'bg-danger';
  }

  getTextBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return 'Expenses';
    } else if (percentage <= 100) {
      return 'Risk of overspend';
    }

    return 'Overspend';
  }

  getClassBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return '';
    } else if (percentage <= 100) {
      return 'warning';
    }

    return 'danger';
  }
}
