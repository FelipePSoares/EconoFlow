import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ListExpenseItemsComponent } from '../list-expense-items/list-expense-items.component';

@Component({
  selector: 'app-detail-expense',
  standalone: true,
  imports: [ListExpenseItemsComponent],
  templateUrl: './detail-expense.component.html',
  styleUrl: './detail-expense.component.css'
})
export class DetailExpenseComponent implements OnInit {
  currentDate!: Date;

  @Input({ required: true })
  categoryId!: string;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  expenseId!: string;

  constructor(private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    var date = this.route.snapshot.paramMap.get('currentDate');
    this.currentDate = new Date(date!);
  }
}
