import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IncomeService } from '../../../core/services/income.service';
import { Router } from '@angular/router';
import { IncomeDto } from '../models/income-dto';

@Component({
  selector: 'app-add-income',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './add-income.component.html',
  styleUrl: './add-income.component.css'
})
export class AddIncomeComponent implements OnInit {
  incomeForm!: FormGroup;
  httpErrors = false;
  errors: any;

  @Input({ required: true })
    projectId!: string;

  constructor(private incomeService: IncomeService, private router: Router) { }

  ngOnInit(): void {
    this.incomeForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      date: new FormControl(new Date(), [Validators.required]),
      amount: new FormControl('', [Validators.required])
    });
  }

  saveIncome() {
    if (this.incomeForm.valid) {
      const name = this.name?.value;
      const date = this.date?.value;
      const amount = this.amount?.value;

      var newIncome = <IncomeDto>({
        name: name,
        date: date,
        amount: amount
      });

      this.incomeService.add(this.projectId, newIncome).subscribe({
        next: response => {
          this.router.navigate(['/projects', this.projectId]);
        },
        error: error => {
          this.httpErrors = true;
          this.errors = error;
        }
      });
    }
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
}
