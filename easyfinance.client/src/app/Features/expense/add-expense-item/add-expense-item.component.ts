import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpenseService } from '../../../core/services/expense.service';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { map } from 'rxjs';
import { Expense } from '../../../core/models/expense';
import { mapper } from '../../../core/utils/mappings/mapper';
import { ExpenseDto } from '../models/expense-dto';
import { compare } from 'fast-json-patch';

@Component({
  selector: 'app-add-expense-item',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './add-expense-item.component.html',
  styleUrl: './add-expense-item.component.css'
})
export class AddExpenseItemComponent implements OnInit {
  private expense!: ExpenseDto;
  private currentDate!: Date;
  expenseItemForm!: FormGroup;
  httpErrors = false;
  errors: any;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  @Input({ required: true })
  expenseId!: string;

  constructor(private expenseService: ExpenseService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.currentDate = new Date(this.route.snapshot.paramMap.get('currentDate')!);

    this.expenseItemForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      date: new FormControl(this.currentDate.getFullYear() + '-' + String(this.currentDate.getMonth() + 1).padStart(2, '0') + '-' + String(this.currentDate.getDate()).padStart(2, '0'), [Validators.required, Validators.pattern('^\\d{4}\\-(0[1-9]|1[012])\\-(0[1-9]|[12][0-9]|3[01])$')]),
      amount: new FormControl('', [Validators.pattern('(\\d+)?(\\,\\d{1,2})?')])
    });

    this.expenseService.getById(this.projectId, this.categoryId, this.expenseId)
      .pipe(map(expense => mapper.map(expense, Expense, ExpenseDto)))
      .subscribe(
        {
          next: res => this.expense = res
        });
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

  save() {
    if (this.expenseItemForm.valid) {
      let name = this.name?.value;
      let date = this.date?.value;
      let amount = this.amount?.value;

      var newExpenseItem = <ExpenseItemDto>({
        name: name,
        date: date,
        amount: amount
      });

      this.expenseService.getById(this.projectId, this.categoryId, this.expenseId)
        .pipe(map(expense => mapper.map(expense, Expense, ExpenseDto)))
        .subscribe(
          {
            next: res => {
              res.items.push(newExpenseItem);

              var patch = compare(this.expense, res);

              this.expenseService.update(this.projectId, this.categoryId, this.expenseId, patch).subscribe({
                next: response => {
                  this.router.navigate(['projects', this.projectId, 'categories', this.categoryId, 'expenses', this.expenseId, { currentDate: date }]);
                },
                error: error => {
                  this.httpErrors = true;
                  this.errors = error;
                }
              });
            }
          });
    }
  }
}
