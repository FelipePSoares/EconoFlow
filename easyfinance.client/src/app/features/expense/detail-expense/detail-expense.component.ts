import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ListExpenseItemsComponent } from '../list-expense-items/list-expense-items.component';
import { todayUTC } from '../../../core/utils/date/date';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';

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
    this.currentDate = todayUTC();
    if (CurrentDateComponent.currentDate.getFullYear() !== this.currentDate.getFullYear() || CurrentDateComponent.currentDate.getMonth() !== this.currentDate.getMonth()) {
      this.currentDate = CurrentDateComponent.currentDate;
    }
  }
}
