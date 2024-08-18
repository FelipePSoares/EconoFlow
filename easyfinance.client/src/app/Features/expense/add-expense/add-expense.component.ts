import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExpenseService } from '../../../core/services/expense.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpenseDto } from '../models/expense-dto';

@Component({
  selector: 'app-add-expense',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './add-expense.component.html',
  styleUrl: './add-expense.component.css'
})
export class AddExpenseComponent implements OnInit {
  private currentDate!: Date;
  expenseForm!: FormGroup;
  httpErrors = false;
  errors: any;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  constructor(private expenseService: ExpenseService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.currentDate = new Date(this.route.snapshot.paramMap.get('currentDate')!);

    this.expenseForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      date: new FormControl(this.currentDate.getFullYear() + '-' + String(this.currentDate.getMonth() + 1).padStart(2, '0') + '-' + String(this.currentDate.getDate()).padStart(2, '0'), [Validators.required, Validators.pattern('^\\d{4}\\-(0[1-9]|1[012])\\-(0[1-9]|[12][0-9]|3[01])$')]),
      amount: new FormControl('', [Validators.pattern('(\\d+)?(\\,\\d{1,2})?')]),
      goal: new FormControl('', [Validators.pattern('[0-9]*')]),
    });
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

  save() {
    if (this.expenseForm.valid) {
      let name = this.name?.value;
      let date = this.date?.value;
      let amount = this.amount?.value;
      let goal = this.goal?.value;

      var newExpense = <ExpenseDto>({
        name: name,
        date: date,
        amount: amount,
        goal: goal
      });

      this.expenseService.add(this.projectId, this.categoryId, newExpense).subscribe({
        next: response => {
          this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, { filterDate: this.currentDate.toISOString().substring(0, 10) }]);
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
        }
      });
    }
  }
}
